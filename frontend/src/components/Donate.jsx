// src/components/Donate.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Donate.css";

const donationPackages = [
  { 
    amount: 10, 
    label: "Supporter", 
   
    duration: "1 month",
    durationDays: 30,
    description: "1 Month Access",
    features: [
      "Unlimited quizzes for 1 month",
      "Download & Share features",
      "Support basic hosting costs"
    ]
  },
  { 
    amount: 25, 
    label: "Champion", 
    
    duration: "3 months",
    durationDays: 90,
    description: "3 Months Access",
    popular: true,
    features: [
      "Unlimited quizzes for 3 months",
      "Download & Share features",
      "Help us scale the platform",
      "Best value!"
    ]
  },
  { 
    amount: 50, 
    label: "Legend", 
   
    duration: "1 year",
    durationDays: 365,
    description: "1 Year Access",
    features: [
      "Unlimited quizzes for 1 year",
      "Download & Share features",
      "Premium supporter status",
      "Maximum support!"
    ]
  },
];

const DonatePage = () => {
  const [selectedPackage, setSelectedPackage] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    // Handle browser back button
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
    let isMounted = true;

    // Fetch PayPal Client ID from backend
    const loadPayPalScript = async () => {
      try {
        console.log('Fetching PayPal Client ID from backend...');
        // Update this URL if your backend runs on a different port
        const BACKEND_URL = 'http://localhost:5000'; // Change port if needed
        const response = await fetch(`${BACKEND_URL}/api/config/paypal-client-id`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('PayPal config received:', data);
        
        if (!data.clientId) {
          console.error("Missing PayPal Client ID in response");
          alert("PayPal configuration error. Please contact support.");
          return;
        }

        if (document.getElementById("paypal-script")) {
          console.log("PayPal script already loaded");
          return;
        }

        if (!isMounted) return;

        console.log('Loading PayPal SDK...');
        const script = document.createElement("script");
        script.id = "paypal-script";
        script.src = `https://www.paypal.com/sdk/js?client-id=${data.clientId}&currency=CAD`;
        script.async = true;
        script.onload = () => {
          if (isMounted) {
            console.log("PayPal SDK loaded successfully");
          }
        };
        script.onerror = () => {
          if (isMounted) {
            console.error("Failed to load PayPal SDK");
          }
        };
        document.body.appendChild(script);
      } catch (error) {
        if (isMounted) {
          console.error("Failed to load PayPal config:", error);
          alert("Could not connect to payment service. Please make sure the backend server is running.");
        }
      }
    };

    loadPayPalScript();

    return () => {
      isMounted = false;
      const script = document.getElementById("paypal-script");
      if (script) {
        console.log("Cleaning up PayPal script");
        script.remove();
      }
    };
  }, []);

  const handleContinue = () => {
    if (selectedPackage === null || selectedPackage === undefined) {
      alert("Please select a donation package.");
      return;
    }

    const selectedPkg = donationPackages[selectedPackage];
    console.log("Navigating to payment page with package:", selectedPkg);
    navigate("/paypal-payment", {
      state: { package: selectedPkg }
    });
  };

  return (
    <div className="donate-page">
      <div className="donate-container">
        <button className="back-btn" onClick={() => navigate('/dashboard')}>
          ← Back
        </button>
        
        <h1 className="page-title">Support QuizCraft</h1>
        <p className="page-subtitle">Choose a donation package to keep QuizCraft free for everyone!</p>

        <div className="packages-grid">
          {donationPackages.map((pkg, index) => {
            const isSelected = selectedPackage === index;
            
            return (
              <div
                key={index}
                className={`package-card ${isSelected ? "selected" : ""} ${pkg.popular ? "popular" : ""}`}
                onClick={() => setSelectedPackage(index)}
              >
                {pkg.popular && <div className="popular-tag">Most Popular</div>}
                {isSelected && <div className="selected-check">✓</div>}
                
                <div className="package-header">
                
                  <h2 className="package-title">{pkg.label}</h2>
                  <p className="package-subtitle">{pkg.description}</p>
                </div>

                <div className="package-body">
                  <div className="package-price">
                    <span className="currency">CAD $</span>
                    <span className="amount">{pkg.amount}</span>
                  </div>

                  <div className="package-features">
                    {pkg.features.map((feature, i) => (
                      <div key={i} className="feature-item">
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button className="continue-button" onClick={handleContinue}>
          Continue
        </button>
      </div>
    </div>
  );
};

export default DonatePage;