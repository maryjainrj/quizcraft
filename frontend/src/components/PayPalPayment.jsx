// src/pages/PayPalPayment.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./PayPalPayment.css";

const PayPalPayment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const paypalRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);

  const packageData = location.state?.package;

  // Redirect if no package selected
  useEffect(() => {
    if (!packageData) {
      navigate("/donate");
    }
  }, [packageData, navigate]);

  useEffect(() => {
    if (!packageData || !paypalRef.current) return;

    // Wait for PayPal SDK to load
    const interval = setInterval(() => {
      if (window.paypal) {
        clearInterval(interval);
        renderPayPalButton();
      }
    }, 100);

    const renderPayPalButton = () => {
      // Clear previous buttons (prevents duplicates)
      if (paypalRef.current) {
        paypalRef.current.innerHTML = "";
      }

      window.paypal
        .Buttons({
          style: {
            shape: "rect",
            color: "blue",        // This is the base we will recolor with CSS
            layout: "vertical",
            label: "paypal",
            height: 55,
          },

          createOrder: (data, actions) => {
            return actions.order.create({
              purchase_units: [
                {
                  amount: {
                    value: packageData.amount.toFixed(2),
                    currency_code: "CAD",
                  },
                  description: `QuizCraft ${packageData.label} Package`,
                },
              ],
            });
          },

          onApprove: async (data, actions) => {
            const order = await actions.order.capture();
            navigate("/payment-success", {
              state: {
                payerName: order.payer.name?.given_name || "Supporter",
                packageLabel: packageData.label,
                amount: packageData.amount,
                transactionId: order.id,
                duration: packageData.duration,
                durationDays: packageData.durationDays,
              },
            });
          },

          onCancel: () => {
            navigate("/donate");
          },

          onError: (err) => {
            console.error("PayPal Error:", err);
            alert("Payment failed. Please try again.");
          },
        })
        .render(paypalRef.current)
        .then(() => setIsLoading(false))
        .catch((err) => {
          console.error("PayPal render failed:", err);
          setIsLoading(false);
        });
    };

    return () => clearInterval(interval);
  }, [packageData, navigate]);

  if (!packageData) return null;

  return (
    <div className="paypal-payment-page">
      <div className="payment-container">
        <button className="back-to-donate" onClick={() => navigate("/dashboard")}>
          ← Back to Dashboard
        </button>

        <div className="payment-header">
          <h1>Complete Your Donation</h1>
          <p>You're supporting QuizCraft with the {packageData.label} package</p>
        </div>

        <div className="summary-card">
          <h3>{packageData.label}</h3>
          <p className="summary-description">{packageData.description}</p>
          <div className="summary-amount">
            <span className="currency">CAD $</span>
            <span className="amount">{packageData.amount}</span>
          </div>
        </div>

        {/* THIS IS THE MAGIC WRAPPER */}
        <div className="paypal-branded-container">
          <div ref={paypalRef}></div>
        </div>

        {isLoading && (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading secure payment...</p>
          </div>
        )}

        <div className="payment-footer">
          <p>
            Your donation keeps QuizCraft free for everyone. Thank you for believing in us!
          </p>
        </div>
      </div>
    </div>
  );
};

export default PayPalPayment;