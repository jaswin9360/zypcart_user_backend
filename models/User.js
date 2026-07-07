const mongoose = require('mongoose')

// 1. Define the Address Sub-Schema first so the User Schema can use it
const addressSchema = new mongoose.Schema({
  name: { type: String, required: true },
  street: { type: String, required: true },
  cityStateZip: { type: String, required: true },
  country: { type: String, required: true },
  phone: { type: String, required: true }
}) // Mongoose will automatically give every pushed address its own unique _id

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true // Ensure usernames stay unique
  },

  name: {
    type: String,
    required: true
  },

  email: {
    type: String,
    required: true,
    unique: true
  },

  password: {
    type: String,
    // REMOVED required: true so Google users can register without a password
  },
  org_password: {
    type: String,
    // This field is optional and can be used to store the original password for Google users if needed
  },

  avatar: {
    type: String // Added this so Google's 'picture' url has a home in your DB
  },

  role: {
    type: String,
    enum: ['buyer', 'seller'],
    default: 'buyer'
  },

  provider: {
    type: String,
    default: 'local'
  },

  isAdmin: {
    type: Boolean,
    default: false
  },
  phone: { type: String, default: null },
  profilePinHash: { type: String, default: null }, 
  tempOtp: { type: String, default: null },
  otpExpiry: { type: Date, default: null },

  // 🌟 Pushed Address Array Option added here
  addresses: [addressSchema],

  // Tracks which address _id in the array above is currently active/selected
  selectedAddressId: { type: mongoose.Schema.Types.ObjectId, default: null }
})

module.exports = mongoose.model('User', userSchema)