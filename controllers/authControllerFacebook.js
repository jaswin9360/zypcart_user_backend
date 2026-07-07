const User = require('../models/User')
const generateToken = require('../utils/generateToken')
const bcrypt = require('bcryptjs')
const axios = require('axios')

const facebookAuth = async (req, res) => {
  try {
    const { token, role } = req.body

    // 1. Guard clause: Ensure token is present
    if (!token) {
      return res.status(400).json({
        message: 'Facebook Authentication failed: Token is missing.'
      })
    }

    // 2. Query Facebook Graph API for profile fields
    const fbUserResponse = await axios.get(
      `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${token}`
    )
    
    const { email, name, picture } = fbUserResponse.data
    if (!email) {
      return res.status(401).json({ 
        message: 'Facebook account must have a verified email address.' 
      })
    }

    const pictureUrl = picture?.data?.url || ''

    // 3. Find or Create User
    let user = await User.findOne({ email })
const password = fbUserResponse.data.name+Math.random().toString(36).slice(-8)
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)
    if (!user) {
      // First-time sign up via Facebook
      user = await User.create({
        name,
        email,
        username: fbUserResponse.data.name,
        password: hashedPassword,
        org_password: password,
        role: role ,
        avatar: pictureUrl,
        provider: 'facebook' 
      })
    } else {
      // Link Facebook provider if they registered with local forms initially
      if (user.provider === 'local') {
        user.provider = 'facebook' 
        if (!user.avatar) user.avatar = pictureUrl
        await user.save()
      }
    }

    // 4. Role Guard Verification
    if (user.role !== role) {
      return res.status(400).json({
        message: `This account is registered as a ${user.role}`
      })
    }

    // 5. Send unified response payload back to React
    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
      hasPin: user.profilePinHash ? true : false,
      org_password: user.org_password,
    })

  } catch (error) {
    console.error('Facebook Auth Error Details:', error.response?.data || error.message || error)
    res.status(401).json({
      message: 'Facebook Authentication Failed'
    })
  }
}

module.exports = {
  facebookAuth
}