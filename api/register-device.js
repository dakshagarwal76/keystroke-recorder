import { getDriveClient } from '../lib/googleDriveClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { deviceFingerprint } = req.body;

    if (!deviceFingerprint || typeof deviceFingerprint !== 'string' || deviceFingerprint.trim() === '') {
      return res.status(400).json({ error: 'Invalid or missing device fingerprint' });
    }

    // Simply return the fingerprint as deviceId
    // Don't create any folders yet
    return res.status(200).json({ deviceId: deviceFingerprint });
  } catch (err) {
    console.error('Register device error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
