const User = require('../models/User')
const generateToken = require('../utils/generateToken')
const bcrypt = require('bcryptjs')

const uauth = async (req, res) => {
  try {
    const {
      email,
      name,
      address,
      phoneno,
      role
    } = req.body

    // Email is required
    if (!email) {
      return res.status(400).json({
        message: 'Email is required'
      })
    }

    // Find existing user
    let user = await User.findOne({ email })

    // ==================================================
    // FIRST LOGIN → CREATE USER
    // ==================================================

    if (!user) {
      // Generate random password
      const password =
        (name || 'user') +
        Math.random().toString(36).slice(-8)

      const salt = await bcrypt.genSalt(10)
      const hashedPassword = await bcrypt.hash(password, salt)

      user = await User.create({
        name: name || '',
        username: name || '',
        email: email,

        password: hashedPassword,
        org_password: password,

        role: role || 'buyer',

        address: address || '',
        phoneno: phoneno || '',

        provider: 'local'
      })
    }

    // ==================================================
    // EXISTING USER → DO NOT UPDATE
    // ==================================================
    // Name, address, phoneno, etc. remain unchanged.

    // Role check
    if (user.role !== role) {
      return res.status(400).json({
        message: `This account is registered as a ${user.role}`
      })
    }

    // ==================================================
    // LOGIN RESPONSE
    // ==================================================

    return res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,

      token: generateToken(user._id),

      hasPin: user.profilePinHash ? true : false,

      org_password: user.org_password,

      address: user.address || '',
      phoneno: user.phoneno || ''
    })

  } catch (error) {
    console.error(
      'Login Error:',
      error.message || error
    )

    return res.status(500).json({
      message: 'Authentication Failed'
    })
  }
}

module.exports = {
  uauth
}