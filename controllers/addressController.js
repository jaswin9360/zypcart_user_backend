const mongoose = require('mongoose');
const User = require('../models/User'); // Path to your User model

// 1. FETCH ALL ADDRESSES FROM USER ARRAY
exports.getAddresses =  async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    res.status(200).json({ 
      addresses: user.addresses || [], // Returns the complete array
      selectedAddressId: user.selectedAddressId 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 2. PUSH A NEW ADDRESS INTO THE ARRAY
exports.addAddress = async (req, res) => {
  try {
    const { name, street, cityStateZip, country, phone } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.userId,
      {
        $push: {
          addresses: { name, street, cityStateZip, country, phone }
        }
      },
      // 🔄 CHANGED: Replaced { new: true } with returnDocument
      { returnDocument: 'after' } 
    );

    if (!updatedUser) return res.status(404).json({ message: 'User not found' });

    if (updatedUser.addresses.length === 1) {
      updatedUser.selectedAddressId = updatedUser.addresses[0]._id;
      await updatedUser.save();
    }

    res.status(201).json({ 
      message: 'New address successfully added to list!', 
      addresses: updatedUser.addresses,
      selectedAddressId: updatedUser.selectedAddressId 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 3. EDIT AN ADDRESS INSIDE THE SUB-ARRAY BLOCK
exports.updateAddress = async (req, res) => {
  try {
    const { name, street, cityStateZip, country, phone } = req.body;

    const updatedUser = await User.findOneAndUpdate(
      { _id: req.params.userId, "addresses._id": req.params.addressId },
      {
        $set: {
          "addresses.$.name": name,
          "addresses.$.street": street,
          "addresses.$.cityStateZip": cityStateZip,
          "addresses.$.country": country,
          "addresses.$.phone": phone
        }
      },
      // 🔄 CHANGED: Replaced { new: true } with returnDocument
      { returnDocument: 'after' }
    );

    if (!updatedUser) return res.status(404).json({ message: 'User or address sequence missing' });

    res.status(200).json({ 
      message: 'Address modified successfully', 
      addresses: updatedUser.addresses 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.selectAddress =  async (req, res) => {
  try {
    const { addressId } = req.body;

    // 1. Validation Safeguard: Check if addressId was sent in request
    if (!addressId) {
      return res.status(400).json({ message: 'Missing addressId parameter in request body' });
    }

    // 2. Format Safeguard: Ensure it's a valid 24-character hex MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({ message: 'Invalid addressId format structure sent to database' });
    }

    // 3. Perform database update using 'returnDocument' to stay deprecation-free
    const user = await User.findByIdAndUpdate(
      req.params.userId, 
      { selectedAddressId: addressId },
      { returnDocument: 'after' } // Cleans up the Mongoose console warning
    );

    if (!user) {
      return res.status(404).json({ message: 'User profile record not found' });
    }

    // Return exact keys expected by your Profile.jsx code
    res.status(200).json({ 
      message: 'Delivery destination updated successfully', 
      selectedAddressId: user.selectedAddressId 
    });

  } catch (err) {
    console.error("Crash logs inside addressController.selectAddress:", err);
    res.status(500).json({ message: 'Internal Server Error handling address selection', error: err.message });
  }
};

// DELETE AN ADDRESS FROM THE ARRAY
exports.deleteAddress = async (req, res) => {
  try {
    const { userId, addressId } = req.params;

    // 1. Structural Check: Ensure incoming target parameters are valid ObjectIds
    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({ message: 'Invalid addressId format structure' });
    }

    // 2. Use $pull to remove the address sub-document matching addressId from the array
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $pull: { addresses: { _id: addressId } }
      },
      { returnDocument: 'after' } // Keeps your console warning-free
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User profile record not found' });
    }

    // 3. Cleanup Safeguard: If the user just deleted their currently selected address,
    // automatically clear the selectedAddressId pointer or point to their first remaining address
    if (updatedUser.selectedAddressId && updatedUser.selectedAddressId.toString() === addressId) {
      updatedUser.selectedAddressId = updatedUser.addresses.length > 0 ? updatedUser.addresses[0]._id : null;
      await updatedUser.save();
    }

    res.status(200).json({
      message: 'Address permanently removed from profile',
      addresses: updatedUser.addresses,
      selectedAddressId: updatedUser.selectedAddressId
    });

  } catch (err) {
    console.error("Crash logs inside addressController.deleteAddress:", err);
    res.status(500).json({ message: 'Internal Server Error handling address deletion', error: err.message });
  }
};