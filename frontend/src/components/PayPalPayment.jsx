// src/pages/PayPalPayment.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./PayPalPayment.css";

const PayPalPayment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = React.useRef(null);
  
  // Get package details from navigation state
  const packageData = location.state?.package;

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

  useEffect(() => {
    // If no package data, redirect back
    if (!packageData) {
      navigate("/donate");
      return;
    }

    let isMounted = true;

    const loadPayPalButtons = async () => {
      try {
        // Wait for PayPal SDK to be available
        const waitForPayPal = () => {
          return new Promise((resolve, reject) => {
            if (window.paypal) {
              console.log("PayPal SDK already available");
              resolve();
              return;
            }

            console.log("Waiting for PayPal SDK to load...");
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds max
            
            const interval = setInterval(() => {
              attempts++;
              
              if (window.paypal) {
                clearInterval(interval);
                console.log("PayPal SDK loaded successfully");
                resolve();
              } else if (attempts >= maxAttempts) {
                clearInterval(interval);
                reject(new Error('PayPal SDK failed to load after 5 seconds'));
              }
            }, 100);
          });
        };

        // Wait for PayPal to be ready
        await waitForPayPal();
        
        if (!isMounted) {
          console.log("Component unmounted, skipping PayPal render");
          return;
        }
        
        const container = containerRef.current;
        if (!container) {
          console.error("PayPal button container not found");
          return;
        }

        // Check if buttons are already rendered
        if (container.children.length > 0 && container.querySelector('.paypal-buttons')) {
          console.log("PayPal buttons already rendered, skipping");
          setIsLoading(false);
          return;
        }
        
        console.log("Rendering PayPal buttons for package:", packageData);
        
        window.paypal
          .Buttons({
            createOrder: (data, actions) => {
              return actions.order.create({
                purchase_units: [
                  {
                    amount: {
                      value: packageData.amount.toFixed(2),
                      currency_code: "CAD",
                    },
                    description: `QuizCraft ${packageData.label} - ${packageData.description}`,
                  },
                ],
              });
            },
            onApprove: async (data, actions) => {
              const order = await actions.order.capture();
              
              // Navigate to success page with payment details including duration
              navigate("/payment-success", {
                state: {
                  payerName: order.payer.name.given_name,
                  packageLabel: packageData.label,
                  amount: packageData.amount,
                  transactionId: order.id,
                  duration: packageData.duration,
                  durationDays: packageData.durationDays,
                }
              });
            },
            onCancel: () => {
              // User cancelled - go back to donate page
              console.log("Payment cancelled by user");
              navigate("/donate");
            },
            onError: (err) => {
              console.error("PayPal error:", err);
              alert("Payment failed. Please try again.");
              navigate("/donate");
            },
            style: {
              shape: "rect",
              color: "gold",
              layout: "vertical",
              label: "paypal",
              height: 50,
            },
          })
          .render("#paypal-button-container")
          .then(() => {
            if (isMounted) {
              console.log("PayPal buttons rendered successfully");
              setIsLoading(false);
            }
          })
          .catch((err) => {
            if (isMounted) {
              console.error("Error rendering PayPal buttons:", err);
              alert("Failed to load payment buttons. Please try again.");
              navigate("/donate");
            }
          });
      } catch (error) {
        if (isMounted) {
          console.error("Error loading PayPal:", error);
          alert("Payment service is not available. Please try again.");
          navigate("/donate");
        }
      }
    };

    loadPayPalButtons();

    // Cleanup function - don't remove the container
    return () => {
      isMounted = false;
      console.log("PayPalPayment component unmounting");
      // Don't touch the DOM here - let PayPal handle its own cleanup
    };
  }, [packageData, navigate]);

  if (!packageData) {
    return null;
  }

  return (
    <div className="paypal-payment-page">
      <div className="payment-container">
        <button className="back-to-donate" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>

        <div className="payment-header">
          <h1>Complete Your Donation</h1>
          <p>You're supporting QuizCraft with the {packageData.label} package</p>
        </div>

        <div className="payment-summary">
          <div className="summary-card">
            <h3>{packageData.label}</h3>
            <p className="summary-description">{packageData.description}</p>
            <div className="summary-amount">
              <span className="currency">CAD $</span>
              <span className="amount">{packageData.amount}</span>
            </div>
          </div>
        </div>

        <div
          ref={containerRef}
          id="paypal-button-container"
          className="paypal-buttons"
          style={{ 
            minHeight: '150px',
            opacity: isLoading ? 0 : 1,
            transition: 'opacity 0.3s ease'
          }}
        >
        </div>

        {isLoading && (
          <div className="loading-spinner" style={{ 
            position: 'absolute', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none'
          }}>
            <div className="spinner"></div>
            <p>Loading payment options...</p>
          </div>
        )}

        <div className="payment-footer">
          <p>
            Your donation helps keep QuizCraft free and accessible for everyone.
            Thank you for your support! 
          </p>
        </div>
      </div>
    </div>
  );
};

export default PayPalPayment;