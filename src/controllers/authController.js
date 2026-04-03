const User = require("../models/User");
const jwt = require("jsonwebtoken");

const exchangeAuth = async (req, res) => {
  const { email, name, image } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        email,
        name,
        image,
      });
    } else {
      // Optional: update latest info (good practice)
      user.name = name || user.name;
      user.image = image || user.image;
      await user.save();
    }

    // ✅ Generate backend JWT
    const userId = user._id.toString();
    const token = jwt.sign(
      {
        sub: userId,
        userId,
        email: user.email,
        name: user.name,
        image: user.image,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
    });
  } catch (error) {
    console.error("Auth Exchange Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { exchangeAuth };