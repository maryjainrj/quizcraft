// src/hooks/useDonationStatus.js
import { useState, useEffect } from 'react';

export const useDonationStatus = () => {
  const [donationStatus, setDonationStatus] = useState({
    hasDonated: false,
    isExpired: false,
    daysRemaining: 0,
    packageLabel: null,
    duration: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkDonationStatus = () => {
      // Check localStorage first
      const hasDonated = localStorage.getItem('hasDonated') === 'true';
      const expiryDate = localStorage.getItem('donationExpiry');
      const packageLabel = localStorage.getItem('donationPackage');
      const duration = localStorage.getItem('donationDuration');

      if (!hasDonated || !expiryDate) {
        setDonationStatus({
          hasDonated: false,
          isExpired: false,
          daysRemaining: 0,
          packageLabel: null,
          duration: null,
        });
        setIsLoading(false);
        return;
      }

      // Check if expired
      const now = new Date();
      const expiry = new Date(expiryDate);
      const isExpired = now > expiry;

      if (isExpired) {
        // Clear expired donation from localStorage
        localStorage.removeItem('hasDonated');
        localStorage.removeItem('donationExpiry');
        localStorage.removeItem('donationPackage');
        localStorage.removeItem('donationDuration');
        
        setDonationStatus({
          hasDonated: false,
          isExpired: true,
          daysRemaining: 0,
          packageLabel: null,
          duration: null,
        });
      } else {
        // Calculate days remaining
        const daysRemaining = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
        
        setDonationStatus({
          hasDonated: true,
          isExpired: false,
          daysRemaining: daysRemaining,
          packageLabel: packageLabel,
          duration: duration,
        });
      }

      setIsLoading(false);
    };

    checkDonationStatus();

    // Check every hour if donation has expired
    const interval = setInterval(checkDonationStatus, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return { donationStatus, isLoading };
};