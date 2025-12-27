import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    telegramId: {
        type: String,
        required: true,
        unique: true
    },
    username: String,
    role: {
        type: String,
        enum: ['user', 'developer', 'owner'],
        default: 'user'
    },
    otp: String,
    otpExpiry: Date,
    isVerified: {
        type: Boolean,
        default: false
    },
    membership: {
        type: String,
        enum: ['free', 'premium', 'vip', 'lifetime'],
        default: 'free'
    },
    membershipExpiry: {
        type: Date,
        default: null
    },
    lastLogin: Date,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const User = mongoose.model('User', userSchema);
export default User;
