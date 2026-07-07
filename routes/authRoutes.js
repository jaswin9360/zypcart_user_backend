const express = require('express')

const {
  registerUser,
  loginUser,
  getProfile
} = require('../controllers/authController')

const { googleAuth } = require('../controllers/authControllerGoogle')
const { facebookAuth } = require('../controllers/authControllerFacebook')
const  addressController =require("../controllers/addressController")
const { githubAuth } = require('../controllers/authControllerGit')
const { forgotPassword } = require('../controllers/authControllerPassword')
const {  verifyOtpAndSendPassword } = require('../controllers/authControllerPassword')
const profileController = require('../controllers/profileController');


const router = express.Router()

router.post('/google', googleAuth)
router.post('/facebook', facebookAuth)
router.post('/github', githubAuth)
router.post('/verify_otp_send_password', verifyOtpAndSendPassword)
router.post('/forgot_password', forgotPassword)
router.post('/register', registerUser)
router.post('/login', loginUser)
router.get('/:userId/profile',  getProfile)
router.post('/:userId/setup_pin',  profileController.setupPin)
router.post('/:userId/verify_pin',  profileController.verifyPin)
router.post('/:userId/change_pin',  profileController.changePinWithPassword)
router.post('/:userId/request_upgrade_otp', profileController.requestSellerUpgradeOtp);
router.post('/:userId/confirm_upgrade', profileController.confirmSellerUpgrade);
router.post('/:userId/request_deactivation_otp', profileController.requestDeactivationOtp);
router.post('/:userId/confirm_deactivation', profileController.confirmDeactivation);
router.get('/:userId/phone_status', profileController.checkPhoneStatus);
router.post('/:userId/add_phone', profileController.addPhoneNumber);
router.post('/:userId/change_password', profileController.changePassword);
router.get("/:userId/addresses",addressController.getAddresses)
router.post('/:userId/addresses', addressController.addAddress)
router.put('/:userId/addresses/select', addressController.selectAddress)
router.put('/:userId/addresses/:addressId', addressController.updateAddress)
router.delete('/:userId/addresses/:addressId', addressController.deleteAddress)

module.exports = router