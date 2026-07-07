const bcrypt = require('bcryptjs')
const User = require('../models/User')
const generateToken = require('../utils/generateToken')

const registerUser = async (req, res) => {
  try {
    const { username, name, email, password ,role} = req.body

    const userExists = await User.findOne({ email })

    if (userExists) {
      return res.status(400).json({
        message: 'User already exists'
      })
    }

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    const user = await User.create({
      username,
      name,
      email,
      password: hashedPassword,
      role
    })

    res.status(201).json({
      _id: user._id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id)
    })
  } catch (error) {
    res.status(500).json({
      message: error.message
    })
  }
}

const loginUser = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    console.log("Attempted login role:", role);

    // 1. Locate the user profile
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid credentials'
      });
    }

    // 2. Validate password match
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: 'Invalid credentials'
      });
    }

    // 3. Check role authorization matches
    if (user.role !== role) {
      return res.status(400).json({
        message: `This account is registered as ${user.role}`
      });
    }

    // 4. Generate the JWT string token
    const token = generateToken(user._id);

    // 5. Append the token into the response header context
    res.setHeader('Authorization', `Bearer ${token}`);
    
    // Optional CORS check rule if your frontend is on a different port/domain:
    // Expose the authorization header to cross-origin browsers so React can read it
    res.setHeader('Access-Control-Expose-Headers', 'Authorization');

    // 6. Send user metadata along with token back to frontend
    res.json({
      _id: user._id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      org_password: user.org_password, // Include original password for frontend display (masked)
      phone: user.phone,  // Included so frontend profile logic knows if it has a phone immediately!
      hasPin: !!user.profilePinHash, // Boolean flag so frontend profile knows whether to show "Set PIN" or "Verify PIN"
      token: token,
      hasPin: user.profilePinHash ? true : false
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

const getProfile = async (req, res) => {
  try {
        const user = await User.findById(req.params.userId);
        // Assuming your schema stores an array of addresses and a reference to the selected one
        const selectedAddress = user.addresses.find(addr => addr._id.toString() === user.selectedAddressId.toString());
        console.log("Selected Address:", selectedAddress);
        res.status(200).json(selectedAddress);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch address" });
    }
};


module.exports = {
  registerUser,
  loginUser,
  getProfile
}
