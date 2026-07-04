const express = require('express');

const router = express.Router();

const supportController = require(
  '../controllers/supportController'
);

const { protect } = require('../middleware/auth');

router.post(
  '/',
  protect,
  supportController.sendMessage
);

router.get(
  '/',
  protect,
  supportController.getMessages
);

module.exports = router;