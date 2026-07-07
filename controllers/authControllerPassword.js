const User = require('../models/User')
const bcrypt = require('bcryptjs')
const twilio = require('twilio')

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

// Global in-memory cache for OTP tokens
const otpCache = {}

// --- STEP 1: REQUEST OTP (Remains the same, stores code in RAM) ---
const forgotPassword = async (req, res) => {
  try {
    let { phone, method } = req.body
    if (!phone) return res.status(400).json({ message: 'Phone number is required.' })

    phone = phone.replace(/[\s\-()]/g, '')
    if (!phone.startsWith('+')) { phone = `+91${phone}` }

    const user = await User.findOne({ phone })
    if (!user) return res.status(404).json({ message: 'No account registered with this phone number.' })

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
    
    otpCache[phone] = {
      otp: otpCode,
      expires: Date.now() + 600000 // 10 minutes
    }

    const messageBody = `Your verification code is: ${otpCode}. Enter it to view your account password.`

    if (method === 'whatsapp') {
      await client.messages.create({
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to: `whatsapp:${phone}`,
        body: messageBody
      })
    } else {
      await client.messages.create({
        from: process.env.TWILIO_SMS_NUMBER,
        to: phone,
        body: messageBody
      })
    }

    res.status(200).json({ message: 'Verification OTP sent successfully!' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to send verification code.' })
  }
}

// --- STEP 2: VERIFY OTP, FETCH PASSWORD, AND RETURN IT ---
const verifyOtpAndSendPassword = async (req, res) => {
  try {
    let { phone, otp, method } = req.body

    if (!phone || !otp) {
      return res.status(400).json({ message: 'Phone number and OTP code are required.' })
    }

    phone = phone.replace(/[\s\-()]/g, '')
    if (!phone.startsWith('+')) { phone = `+91${phone}` }

    // 1. Verify OTP using the local in-memory cache
    const cachedRecord = otpCache[phone]
    if (!cachedRecord) {
      return res.status(400).json({ message: 'No active OTP request found for this number.' })
    }
    if (cachedRecord.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP verification code.' })
    }
    if (Date.now() > cachedRecord.expires) {
      delete otpCache[phone]
      return res.status(400).json({ message: 'OTP verification code has expired.' })
    }

    // 2. Look up the user by phone number to fetch their existing password
    const user = await User.findOne({ phone })
    if (!user) {
      delete otpCache[phone]
      return res.status(404).json({ message: 'User record no longer found.' })
    }

    // Clean up memory cache immediately
    delete otpCache[phone]

    // Automatically ensure their verification flag is true since they passed OTP
    user.isVerified = true
    await user.save()

    // 3. Extract the existing password directly from the database document

    const originalPassword = user.org_password || 'No password set for this account.' 
    // 4. Send the password back to their phone number via Twilio
    const messageBody = `Verification successful! The password registered to your account is: ${originalPassword}`

    if (method === 'whatsapp') {
      await client.messages.create({
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to: `whatsapp:${phone}`,
        body: messageBody
      })
    } else {
      await client.messages.create({
        from: process.env.TWILIO_SMS_NUMBER,
        to: phone,
        body: messageBody
      })
    }

    // 5. Return the password inside the JSON payload so the frontend can display it
    res.status(200).json({ 
      message: 'Account verified successfully!',
      password: originalPassword // Sent securely to your React client state
    })

  } catch (error) {
    console.error('Fetch Password Error:', error)
    res.status(500).json({ message: 'Internal server error processing password retrieval.' })
  }
}

module.exports = { forgotPassword, verifyOtpAndSendPassword }