const User = require('../models/User');
const bcrypt = require('bcryptjs');

const twilioClient = require('twilio')(
  process.env.TWILIO_ACCOUNT_SID, 
  process.env.TWILIO_AUTH_TOKEN
);

const generateOtp = () => Math.floor(1000 + Math.random() * 9000).toString();

// 1. GET PROFILE DATA
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password -profilePinHash -tempOtp -otpExpiry');
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Convert presence of the hash directly into a dynamic frontend boolean flag
    res.json({ 
      user: {
        ...user.toObject(),
        hasPin: !!user.profilePinHash
      } 
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching profile' });
  }
};

// 2. SET PIN (First Time Only)
exports.setupPin = async (req, res) => {
  const { pin } = req.body;
  if (!pin || pin.length !== 4 || !/^\d+$/.test(pin)) {
    return res.status(400).json({ message: 'PIN must be a 4-digit number' });
  }

  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.profilePinHash) return res.status(400).json({ message: 'PIN already configured' });

    const salt = await bcrypt.genSalt(10);
    user.profilePinHash = await bcrypt.hash(pin, salt);
    await user.save();

    res.status(200).json({ message: 'Secure PIN configured successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error saving PIN' });
  }
};

// 3. VERIFY PIN
exports.verifyPin = async (req, res) => {
  const { pin } = req.body;
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.profilePinHash) return res.status(400).json({ message: 'No PIN configured yet' });

    const isMatch = await bcrypt.compare(pin, user.profilePinHash);
    if (!isMatch) return res.status(401).json({ message: 'Invalid PIN identification' });

    res.status(200).json({
      message: 'Access Granted',
      sensitiveData: { 
        email: user.email, 
        phone: user.phone || 'No phone link present' 
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'PIN verification loop failed' });
  }
};

// 4. CHANGE PIN (Requires Account Password Verification)
exports.changePinWithPassword = async (req, res) => {
  const { password, newPin } = req.body;

  if (!newPin || newPin.length !== 4 || !/^\d+$/.test(newPin)) {
    return res.status(400).json({ message: 'New PIN must be a 4-digit number' });
  }

  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect account password' });
    }

    const salt = await bcrypt.genSalt(10);
    user.profilePinHash = await bcrypt.hash(newPin, salt);
    await user.save();

    res.status(200).json({ message: 'Account security PIN updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error updating security PIN' });
  }
};

exports.checkPhoneStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ 
      hasPhone: !!user.phone, 
      phone: user.phone,
      hasPin: !!user.profilePinHash
    });
  } catch (err) {
    res.status(500).json({ message: 'Polling framework error' });
  }
};

/**
 * 2. UPGRADE TO SELLER: STEP 1 - REQUEST SMS OTP
 */
exports.requestSellerUpgradeOtp = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.phone) return res.status(400).json({ message: 'No phone number linked to this account.' });

    const otp = generateOtp();

    // Send real SMS via Twilio
    await twilioClient.messages.create({
      body: `ShopEase Security: Your verification code to activate your Seller Account is ${otp}. Valid for 5 minutes.`,
      from: process.env.TWILIO_SMS_NUMBER,
      to: user.phone
    });

    // Save token parameters locally
    user.tempOtp = otp;
    user.otpExpiry = Date.now() + 300000; // 5 minutes
    await user.save();

    res.status(200).json({ message: 'Upgrade verification OTP sent to your registered phone number.' });
  } catch (err) {
    console.error('Twilio Seller Upgrade Error:', err.message);
    res.status(500).json({ message: 'Failed to send upgrade OTP via Twilio.' });
  }
};

/**
 * 3. UPGRADE TO SELLER: STEP 2 - CONFIRM OTP & UPGRADE
 */
exports.confirmSellerUpgrade = async (req, res) => {
  const { otp } = req.body;

  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.tempOtp || user.tempOtp !== otp || Date.now() > user.otpExpiry) {
      return res.status(400).json({ message: 'Invalid or expired OTP verification code.' });
    }

    // Upgrade roles
    user.role = 'seller';
    user.tempOtp = null;
    user.otpExpiry = null;
    await user.save();

    res.status(200).json({ message: 'Account upgraded to Seller status successfully!', role: 'seller' });
  } catch (err) {
    res.status(500).json({ message: 'Transaction error during account upgrade.' });
  }
};

/**
 * 4. DEACTIVATE SELLER: STEP 1 - REQUEST SMS OTP
 */
exports.requestDeactivationOtp = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.phone) return res.status(400).json({ message: 'No registered phone number found.' });

    const otp = generateOtp();

    // Send real SMS via Twilio
    await twilioClient.messages.create({
      body: `ShopEase Alert: Your verification code to deactivate your Seller Account is ${otp}. Valid for 5 minutes.`,
      from: process.env.TWILIO_SMS_NUMBER,
      to: user.phone
    });

    user.tempOtp = otp;
    user.otpExpiry = Date.now() + 300000; 
    await user.save();

    res.status(200).json({ message: 'Deactivation security code sent to your registered phone number.' });
  } catch (err) {
    console.error('Twilio Deactivation Error:', err.message);
    res.status(500).json({ message: 'Failed to send deactivation OTP.' });
  }
};

/**
 * 5. DEACTIVATE SELLER: STEP 2 - CONFIRM OTP & REVERT TO BUYER
 */
exports.confirmDeactivation = async (req, res) => {
  const { otp } = req.body;

  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.tempOtp || user.tempOtp !== otp || Date.now() > user.otpExpiry) {
      return res.status(400).json({ message: 'Invalid or expired OTP verification code.' });
    }

    // Downgrade back to buyer
    user.role = 'buyer';
    user.tempOtp = null;
    user.otpExpiry = null;
    await user.save();

    res.status(200).json({ message: 'Seller account deactivated. Reverted back to buyer account.', role: 'buyer' });
  } catch (err) {
    res.status(500).json({ message: 'Transaction fault inside deactivation block.' });
  }
};


// 8. LIVE PHONE POLLING CHECK (Hits every 1 second from frontend)
exports.checkPhoneStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Returns true if a phone number is registered in MongoDB
    res.json({ hasPhone: !!user.phone, phone: user.phone });
  } catch (err) {
    res.status(500).json({ message: 'Polling framework error' });
  }
};

// 9. UPDATE PHONE NUMBER DIRECTLY
exports.addPhoneNumber = async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ message: 'Phone number is required' });

  try {
    // 1. Check if the phone number is already registered to ANY user in the database
    const existingUserWithPhone = await User.findOne({ phone });
    
    if (existingUserWithPhone) {
      return res.status(400).json({ 
        message: 'This phone number is already registered. Please enter a different number.' 
      });
    }

    // 2. Fetch the target user making the request
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // 3. Update and save the document records
    user.phone = phone;
    await user.save();
    
    res.json({ message: 'Phone number linked successfully!', phone: user.phone });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update phone number due to a server error' });
  }
};



// 10. SECURE CHANGE PASSWORD (UPDATED)
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Verify current password integrity
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Incorrect current password' });

    // Hash and save new password structure
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    user.password = hashedPassword;
    user.org_password = newPassword;
    await user.save();

    // Send the updated password string back so the frontend can display it instantly
    res.json({ 
      message: 'Account login password updated successfully!',
      updatedPassword: hashedPassword 
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update account password' });
  }
};