const express = require('express');
const router = express.Router();

router.get('/paypal-client-id', (req, res) => {
  try {
    console.log('PayPal Client ID:', process.env.PAYPAL_CLIENT_ID);
    const clientId = process.env.PAYPAL_CLIENT_ID;
    
    if (!clientId) {
      console.error('PayPal Client ID not found in environment variables');
      return res.status(500).json({ error: 'PayPal Client ID not configured' });
    }
    
    res.json({ clientId });
  } catch (error) {
    console.error('Error fetching PayPal config:', error);
    res.status(500).json({ error: 'Failed to get PayPal config' });
  }
});

module.exports = router;