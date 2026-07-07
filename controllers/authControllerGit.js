const User = require('../models/User')
const generateToken = require('../utils/generateToken')
const bcrypt = require('bcryptjs')
const axios = require('axios')

const githubAuth = async (req, res) => {
  try {
    const { code, role } = req.body
    console.log("Received GitHub auth request with role:", role)

    // 1. Guard clause: Stop early if no code parameter is passed
    if (!code) {
      return res.status(400).json({
        message: 'GitHub Authorization Code is missing.'
      })
    }

    // 2. Exchange the temporary frontend code for a secure Access Token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code
      },
      { headers: { Accept: 'application/json' } }
    )

    const accessToken = tokenResponse.data.access_token

    if (!accessToken) {
      return res.status(401).json({
        message: 'Failed to retrieve Access Token from GitHub'
      })
    }

    // 3. Request user profile metadata using the Access Token
    const profileResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` }
    })

    const { login, name, avatar_url } = profileResponse.data
    let email = profileResponse.data.email

    // 4. Fallback: If the user's email visibility setting is private, 
    // fetch their email addresses directly using an extended endpoint
    if (!email) {
      const emailResponse = await axios.get('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      const primaryEmailObj = emailResponse.data.find(e => e.primary && e.verified)
      email = primaryEmailObj ? primaryEmailObj.email : null
    }

    if (!email) {
      return res.status(401).json({
        message: 'A verified primary email is required from your GitHub account.'
      })
    }
console.log(profileResponse.data)
    // 5. Look up the user in MongoDB by email
    let user = await User.findOne({ email })
    const password = profileResponse.data.name + Math.random().toString(36).slice(-8)
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)
    if (!user) {
      // Create new account using your simplified schema fields
      user = await User.create({
        name: name || login, // Uses profile name or falls back to public username string
        email,
        username: profileResponse.data.name,
        password: hashedPassword,
        org_password: password,
        role: role || 'buyer',
        avatar: avatar_url,
        provider: 'github',
      })
    } else {
      // If they previously signed up locally, link their GitHub profile details safely
      if (user.provider === 'local') {
        user.provider = 'github'
        if (!user.avatar) user.avatar = avatar_url
        await user.save()
      }
    }

    // 6. Role Matching Safeguard (Matches local and Google logic)
    if (user.role !== role) {
      return res.status(400).json({
        message: `This account is registered as a ${user.role}`
      })
    }

    // 7. Success Response: Formatted identically to your local/Google endpoints
    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
      hasPin: user.profilePinHash ? true : false  ,
      org_password: user.org_password,
    })

  } catch (error) {
    console.error('GitHub Auth Error Details:', error.response?.data || error.message || error)
    res.status(401).json({
      message: 'GitHub Authentication Failed'
    })
  }
}

module.exports = {
  githubAuth
}