const User = require('../models/User')
const generateToken = require('../utils/generateToken') 
const bcrypt = require('bcryptjs')// Replaced local jwt string logic with your utility
const axios = require('axios')

const googleAuth = async (req, res) => {
  try {
    const { token, role } = req.body

    // 1. Guard clause: Ensure the access token is present
    if (!token) {
      return res.status(400).json({
        message: 'Google Authentication failed: Token is missing.'
      })
    }

    // 2. Exchange the Access Token for the user's profile information
    const googleUserResponse = await axios.get(
      `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${token}`
    )
    
    const { email, name, picture } = googleUserResponse.data

    if (!email) {
      return res.status(401).json({ 
        message: 'Invalid token payload from Google' 
      })
    }

    // 3. Lookup existing account by email
    let user = await User.findOne({ email })
    const password = googleUserResponse.data.given_name+Math.random().toString(36).slice(-8)
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)
    // First Login → Register User using your identical schema payload
    if (!user) {
      user = await User.create({
        name,
        username: googleUserResponse.data.given_name,
        password: hashedPassword,
        org_password: password, // Creates a random password since Google users won't have one
        email,
        role: role || 'buyer', // Assigns chosen toggle role from frontend
        avatar: picture,
        provider: 'google'     // Identifies OAuth creation
      })
    }

    // 4. Role Matching Safeguard (Matches your local login security logic)
    if (user.role !== role) {
      return res.status(400).json({
        message: `This account is registered as a ${user.role}`
      })
    }

    // 5. Success Response: Formatted identically to your local loginUser output
    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id) ,
      hasPin: user.profilePinHash ? true : false,
      org_password: user.org_password,
      // Uses your exact central token generator utility
    })

  } catch (error) {
    console.error('Google Auth Error Details:', error.response?.data || error.message || error)
    res.status(401).json({
      message: 'Google Authentication Failed'
    })
  }
}

module.exports = {
  googleAuth
}