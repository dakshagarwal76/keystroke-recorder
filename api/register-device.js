import { getDriveClient } from '../lib/googleDriveClient';

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { deviceFingerprint, browserInfo, osInfo } = req.body;

    if (!deviceFingerprint || typeof deviceFingerprint !== 'string' || deviceFingerprint.trim() === '') {
      return res.status(400).json({ error: 'Invalid or missing device fingerprint' });
    }

    console.log('Device registered:', {
      fingerprint: deviceFingerprint,
      browser: browserInfo?.name || 'Unknown',
      os: osInfo?.name || 'Unknown'
    });

    // Simply return the fingerprint as deviceId
    // Don't create any folders yet
    return res.status(200).json({ 
      deviceId: deviceFingerprint,
      success: true 
    });
  } catch (err) {
    console.error('Register device error:', err);
    return res.status(500).json({ 
      error: err.message || 'Internal Server Error' 
    });
  }
}
