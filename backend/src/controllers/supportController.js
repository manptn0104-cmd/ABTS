const SupportMessage =
require('../models/SupportMessage');

exports.sendMessage = async (
  req,
  res
) => {

  try {

    const {
      message,
      sender,
    } = req.body;

    const supportMessage =
      await SupportMessage.create({

        userId: req.user._id,

        sender,

        message,

      });

    res.status(201).json({
      success: true,
      data: supportMessage,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};

exports.getMessages = async (
  req,
  res
) => {

  try {

    const messages =
      await SupportMessage.find({ userId: req.user._id })
      .sort({ createdAt: 1 });

    res.json({
      success: true,
      data: messages,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};