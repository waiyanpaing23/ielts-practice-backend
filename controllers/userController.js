const Room = require("../models/Room");
const TestAttempt = require("../models/TestAttempt");
const User = require("../models/User");

exports.getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};


exports.updateUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.fullName = req.body.fullName || user.fullName;
        // You can add other fields here later (like phone number, avatar, etc.)

        const updatedUser = await user.save();

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                _id: updatedUser._id,
                fullName: updatedUser.fullName,
                email: updatedUser.email,
                role: updatedUser.role
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, message: 'Server Error updating profile.' });
    }
};

exports.deleteUserAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    // Verify the user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.'
      });
    }

    await Promise.all([
      TestAttempt.deleteMany({ user: userId }),
      Room.deleteMany({ tutor_id: userId }),
      Room.updateMany(
        { "participants.user": userId },
        { $pull: { participants: { user: userId } } }
      )
    ]);

    // delete the user profile
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: 'Account and all associated data permanently deleted.'
    });

  } catch (error) {
    console.error('Account Deletion Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during account deletion process.'
    });
  }
};