"use client"

import { useState, useEffect } from "react"
import { useCustomer, CheckoutDialog } from "autumn-js/react"
import { useUser } from "@/lib/user-store/provider"

interface SubscriptionProductCardProps {
  features?: {
    messages?: {
      balance: number | null
    }
  }
}

export function SubscriptionProductCard({ features }: SubscriptionProductCardProps) {
  const { customer, checkout } = useCustomer()
  const { user } = useUser()
  const [selectedPlan, setSelectedPlan] = useState<"growth" | "pro" | "scale">("growth")
  const [isLoading, setIsLoading] = useState(false)

  const isGuest = user?.anonymous === true || !user
  const currentProduct = customer?.products?.[0]?.id

  // Plan configurations
  const plans = {
    growth: { id: "growth", name: "Growth", price: 29.0, credits: 100 },
    pro: { id: "pro", name: "Pro", price: 89.0, credits: "unlimited" },
    scale: { id: "scale", name: "Scale", price: 200.0, credits: "unlimited" },
  }

  const currentPlan = plans[selectedPlan]

  const handlePlanClick = (planId: "growth" | "pro" | "scale") => {
    setSelectedPlan(planId)
  }

  const handleCheckout = async () => {
    if (isGuest) return

    setIsLoading(true)
    try {
      await checkout({
        productId: selectedPlan,
        dialog: CheckoutDialog,
        successUrl: window.location.origin + "/",
      })
    } catch (error) {
      console.error("Checkout error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate credits used for Growth plan
  const creditsUsed =
    selectedPlan === "growth" && features?.messages?.balance !== undefined && features?.messages?.balance !== null
      ? 100 - features.messages.balance
      : 0

  const displayCredits = currentPlan.credits === "unlimited" ? "∞" : currentPlan.credits

  return (
    <div className="checkout__box">
      <h2>Credits</h2>
      <h4 className="price">
        <span className="price_name">Price</span>
        <span className="sub_price">${currentPlan.price.toFixed(2)}</span>
        <br />
      </h4>

      <div className="credits-line">
        <span className="credits_name">Credits</span>
        <span className="credits_value">
          {selectedPlan === "growth" ? `${creditsUsed} / ${displayCredits}` : displayCredits}
        </span>
      </div>

      <hr />

      <h3>
        Purchase: <span className="sub-txt">Subscription</span>
      </h3>

      <div className="checkout__opts">
        {/* Growth Plan */}
        <div
          className={`opt opt1 ${selectedPlan === "growth" ? "selected" : ""}`}
          data-rel="growth"
          data-price="29.00"
          onClick={() => handlePlanClick("growth")}
        >
          <div className="gridme">
            <div className="radio">
              <span className="radio_btn"></span>
            </div>
            <div className="lbl">
              Growth <b>Plan</b>
            </div>
            <div className="radio_price">${plans.growth.price.toFixed(2)}</div>
          </div>
        </div>

        {/* Pro Plan */}
        <div
          className={`opt opt2 ${selectedPlan === "pro" ? "selected" : ""}`}
          data-rel="pro"
          data-price="89.00"
          onClick={() => handlePlanClick("pro")}
        >
          <div className="gridme">
            <div className="radio">
              <span className="radio_btn"></span>
            </div>
            <div className="lbl">
              Pro <b>Plan</b>
            </div>
            <div className="radio_price">${plans.pro.price.toFixed(2)}</div>
          </div>
          <div className="info-txt">Free 2-day Fedex Shipping, No commitment, pause anytime.</div>
          <div className="freq_drop">
            <div className="freq_selected" style={{ cursor: "default" }}>
              <i className="las la-calendar"></i>
              Deliver every <b>90 days</b>
            </div>
          </div>
        </div>

        {/* Scale Plan */}
        <div
          className={`opt opt3 ${selectedPlan === "scale" ? "selected" : ""}`}
          data-rel="scale"
          data-price="200.00"
          onClick={() => handlePlanClick("scale")}
        >
          <div className="gridme">
            <div className="radio">
              <span className="radio_btn"></span>
            </div>
            <div className="lbl">
              Scale <b>Plan</b>
            </div>
            <div className="radio_price">${plans.scale.price.toFixed(2)}</div>
          </div>
          <div className="info-txt">Free 2-day Fedex Shipping, No commitment, pause anytime.</div>
          <div className="freq_drop">
            <div className="freq_selected" style={{ cursor: "default" }}>
              <i className="las la-calendar"></i>
              Deliver every <b>90 days</b>
            </div>
          </div>
        </div>
      </div>

      <div className="checkout__btns">
        <div className="cart_btn full-width">
          <button
            type="button"
            className="btn addtocart"
            onClick={handleCheckout}
            disabled={currentProduct === selectedPlan || isLoading || isGuest}
          >
            {currentProduct === selectedPlan
              ? "Current Plan"
              : isLoading
                ? "Loading..."
                : isGuest
                  ? "Sign In to Subscribe"
                  : "Add to Cart"}
          </button>
        </div>
      </div>

      <div className="guarantee">
        <div>
          <i className="las la-certificate"></i>
          2-Week Trial
        </div>
        <div className="line"></div>
        <div>
          <i className="las la-truck"></i>
          Free US Shipping
        </div>
      </div>

      <style jsx>{`
        body {
          font-family: "Open Sans", sans-serif;
          background: #f4f4f4;
        }

        .checkout__box {
          padding: 20px;
          background: #fff;
          margin: 0 auto;
          border: 1px solid #ddd;
          max-width: 400px;
        }

        :global(.dark) .checkout__box {
          background: #fff;
          border: 1px solid #ddd;
        }

        .checkout__box h2 {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 10px;
          color: black;
        }

        .price {
          text-align: right;
          font-size: 16px;
          font-weight: 700;
          color: black;
          margin-bottom: 10px;
          position: relative;
        }

        .price_name {
          position: absolute;
          left: 0;
        }

        .reg_price.crossed {
          color: #888;
          text-decoration: line-through;
          font-weight: 400;
        }

        .sub_price {
          color: black;
        }

        .credits-line {
          text-align: right;
          font-size: 16px;
          font-weight: 700;
          color: black;
          margin-bottom: 10px;
          position: relative;
        }

        .credits_name {
          position: absolute;
          left: 0;
          font-weight: 400;
          font-size: 14px;
        }

        .credits_value {
          color: black;
        }

        h3 {
          font-size: 12px;
          text-transform: uppercase;
          font-weight: 600;
          letter-spacing: 1.5px;
          color: black;
        }

        hr {
          border: none;
          margin: 10px;
          padding: 0;
          border-bottom: 1px solid #ddd;
        }

        .sub-txt {
          color: inherit;
        }

        .checkout__opts .opt {
          padding: 15px 0;
          border: 1px solid #ccc;
          border-radius: 5px;
          margin-bottom: 15px;
          font-size: 14px;
          cursor: pointer;
        }

        .checkout__opts .opt.selected {
          border: 2px solid black;
        }

        .checkout__opts .opt.selected .radio_btn {
          border: 2px solid #3ab54b;
        }

        .checkout__opts .opt.selected .radio_btn:before {
          content: "";
          width: 14px;
          height: 14px;
          display: block;
          position: absolute;
          background: #3ab54b;
          border-radius: 50%;
          top: 3px;
          right: 3px;
        }

        .checkout__opts .opt.opt2,
        .checkout__opts .opt.opt3 {
          padding-bottom: 10px;
          cursor: pointer;
        }

        .checkout__opts .opt .lbl b {
          color: #3ab54b;
        }

        .checkout__opts .opt .info-txt {
          padding-left: 40px;
          font-size: 12px;
          padding-bottom: 15px;
          padding-top: 6px;
          color: #666;
          font-style: italic;
          padding-right: 15px;
        }

        .gridme {
          display: grid;
          grid-template-columns: 30px 1fr 60px;
          align-items: center;
          padding: 0 15px;
          color: black;
        }

        .radio_btn {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 1px solid #bbb;
          display: block;
          position: relative;
        }

        .radio_price {
          text-align: right;
        }

        .freq_drop {
          border-top: 1px solid #bbb;
          padding: 10px 15px 0;
          font-size: 14px;
        }

        .freq_selected {
          position: relative;
          color: black;
        }

        .freq_selected i {
          font-size: 20px;
          vertical-align: middle;
          color: black;
        }

        .freq_selected i.la-angle-down {
          font-size: 14px;
          display: block;
          position: absolute;
          right: 5px;
          top: 5px;
        }

        .checkout__btns {
          display: block;
          margin-bottom: 20px;
        }

        .full-width {
          width: 100%;
        }

        .btn.addtocart {
          display: block;
          border-radius: 4px;
          color: black;
          font-size: 16px;
          font-weight: 700;
          width: 100%;
          border: 1px solid rgb(255, 187, 16);
          background-color: rgb(255, 187, 16);
          height: 60px;
          letter-spacing: 1px;
          transition: 0.5s;
          cursor: pointer;
        }

        .btn.addtocart:hover:not(:disabled) {
          background-color: #3ab54b;
          border-color: #3ab54b;
          color: white;
        }

        .btn.addtocart:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .guarantee {
          display: grid;
          grid-template-columns: 1fr 2px 1fr;
          grid-column-gap: 5px;
          text-align: center;
          padding: 8px 0;
          border-top: 1px solid #ddd;
          border-bottom: 1px solid #ddd;
        }

        .guarantee div {
          padding: 10px;
          font-size: 12px;
          color: black;
        }

        .guarantee div.line {
          padding: 0;
          border-right: 1px solid #ddd;
        }

        .guarantee i {
          display: block;
          font-size: 25px;
          color: black;
          margin-bottom: 10px;
        }
      `}</style>

      {/* Line Awesome Icons CDN */}
      <link
        rel="stylesheet"
        href="https://maxst.icons8.com/vue-static/landings/line-awesome/line-awesome/1.3.0/css/line-awesome.min.css"
      />
    </div>
  )
}
