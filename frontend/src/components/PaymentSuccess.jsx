// src/pages/PaymentSuccess.jsx
import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./PaymentSuccess.css";

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get payment details from navigation state
  const paymentData = location.state;

  // Handle browser back button
  useEffect(() => {
    const handlePopState = (e) => {
      e.preventDefault();
      navigate('/dashboard', { replace: true });
    };

    window.history.pushState(null, '', window.location.pathname);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [navigate]);

  // If no payment data, redirect to dashboard
  useEffect(() => {
    if (!paymentData) {
      navigate("/dashboard");
    }
  }, [paymentData, navigate]);

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  if (!paymentData) {
    return null;
  }

  return (
    <div className="payment-success-page">
      <div className="success-container">
        <div className="success-animation">
          <div className="checkmark-circle">
            <svg className="checkmark" viewBox="0 0 52 52">
              <circle className="checkmark-circle-path" cx="26" cy="26" r="25" fill="none"/>
              <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
            </svg>
          </div>
        </div>

        <h1 className="success-title">Payment Successful! 🎉</h1>
        <p className="success-message">
          Thank you <strong>{paymentData.payerName}</strong> for your generous donation!
        </p>

        <div className="payment-details-card">
          <div className="detail-row">
            <span className="detail-label">Package:</span>
            <span className="detail-value">{paymentData.packageLabel}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Amount:</span>
            <span className="detail-value amount-highlight">CAD ${paymentData.amount}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Transaction ID:</span>
            <span className="detail-value transaction-id">{paymentData.transactionId}</span>
          </div>
        </div>

        <div className="success-info">
          <p>
            Your donation helps keep QuizCraft free and accessible for everyone. 
            We truly appreciate your support! 💜
          </p>
          <p className="receipt-note">
            📧 A receipt has been sent to your email address.
          </p>
        </div>

        <button className="back-to-dashboard-btn" onClick={handleBackToDashboard}>
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default PaymentSuccess;