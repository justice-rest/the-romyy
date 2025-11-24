"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useCustomer, CheckoutDialog } from "autumn-js/react"
import { useUser } from "@/lib/user-store/provider"

interface SubscriptionProductCardProps {
  planId: "growth" | "pro" | "scale"
  planName: string
  price: number
  description: string
  features: string[]
  credits: number | "unlimited"
  creditsUsed?: number
}

export function SubscriptionProductCard({
  planId,
  planName,
  price,
  description,
  features,
  credits,
  creditsUsed = 0,
}: SubscriptionProductCardProps) {
  const { customer, checkout } = useCustomer()
  const { user } = useUser()
  const [isLoading, setIsLoading] = useState(false)

  const isGuest = user?.anonymous === true || !user
  const currentProduct = customer?.products?.[0]?.id
  const isCurrentPlan = currentProduct === planId

  const handleCheckout = async () => {
    if (isGuest || isCurrentPlan) return

    setIsLoading(true)
    try {
      await checkout({
        productId: planId,
        dialog: CheckoutDialog,
        successUrl: window.location.origin + "/",
      })
    } catch (error) {
      console.error("Checkout error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const displayCredits = credits === "unlimited" ? "∞" : credits
  const creditPercent = credits === "unlimited" ? 0 : Math.min((creditsUsed / (credits as number)) * 100, 100)

  return (
    <div className="checkout__box">
      <h2>{planName}</h2>
      <h4 className="price">
        <span className="price_name">Price</span>
        <span className="sub_price">${price.toFixed(2)}</span>
        <br />
      </h4>

      <hr />

      <h3>
        Purchase: <span className="sub-txt">Subscription</span>
      </h3>

      <div className="checkout__opts">
        <div className="opt opt2 selected">
          <div className="gridme">
            <div className="radio">
              <span className="radio_btn"></span>
            </div>
            <div className="lbl">
              {planName} <b>Plan</b>
            </div>
            <div className="radio_price">${price.toFixed(2)}</div>
          </div>
          <div className="info-txt">{description}</div>
          <div className="freq_drop">
            <div className="freq_selected" style={{ cursor: "default" }}>
              <i className="las la-calendar"></i>
              {features[0] || "Deliver every 90 days"}
            </div>
          </div>
        </div>
      </div>

      {/* Credits Display */}
      <div className="credits-display">
        <div className="credits-info">
          <span className="credits-label">Credits</span>
          <span className="credits-value">
            {creditsUsed} / {displayCredits}
          </span>
        </div>
        {credits !== "unlimited" && (
          <div className="credits-bar">
            <div className="credits-progress" style={{ width: `${creditPercent}%` }}></div>
          </div>
        )}
      </div>

      <div className="checkout__btns">
        <div className="cart_btn full-width">
          <Button
            type="button"
            className="btn addtocart"
            onClick={handleCheckout}
            disabled={isCurrentPlan || isLoading || isGuest}
          >
            {isCurrentPlan
              ? "Current Plan"
              : isLoading
                ? "Loading..."
                : isGuest
                  ? "Sign In to Subscribe"
                  : "Subscribe Now"}
          </Button>
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
        .checkout__box {
          padding: 20px;
          background: #fff;
          margin: 0 auto;
          border: 1px solid #ddd;
          border-radius: 8px;
          max-width: 400px;
        }

        :global(.dark) .checkout__box {
          background: #1a1a1a;
          border-color: #333;
        }

        .checkout__box h2 {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 10px;
          color: black;
        }

        :global(.dark) .checkout__box h2 {
          color: white;
        }

        .price {
          text-align: right;
          font-size: 16px;
          font-weight: 700;
          color: black;
          margin-bottom: 10px;
          position: relative;
        }

        :global(.dark) .price {
          color: white;
        }

        .price_name {
          position: absolute;
          left: 0;
          font-weight: 400;
          font-size: 14px;
          color: #666;
        }

        :global(.dark) .price_name {
          color: #999;
        }

        .sub_price {
          font-size: 20px;
        }

        hr {
          border: none;
          margin: 10px 0;
          padding: 0;
          border-bottom: 1px solid #ddd;
        }

        :global(.dark) hr {
          border-bottom-color: #333;
        }

        h3 {
          font-size: 12px;
          text-transform: uppercase;
          font-weight: 600;
          letter-spacing: 1.5px;
          color: black;
          margin-bottom: 15px;
        }

        :global(.dark) h3 {
          color: white;
        }

        .sub-txt {
          color: #3ab54b;
        }

        .checkout__opts .opt {
          padding: 15px 0;
          border: 2px solid black;
          border-radius: 5px;
          margin-bottom: 15px;
          font-size: 14px;
          cursor: default;
        }

        :global(.dark) .checkout__opts .opt {
          border-color: #3ab54b;
        }

        .radio_btn {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid #3ab54b;
          display: block;
          position: relative;
        }

        .radio_btn:before {
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

        .gridme {
          display: grid;
          grid-template-columns: 30px 1fr 80px;
          align-items: center;
          padding: 0 15px;
          color: black;
        }

        :global(.dark) .gridme {
          color: white;
        }

        .radio_price {
          text-align: right;
          font-weight: 600;
        }

        .lbl b {
          color: #3ab54b;
        }

        .info-txt {
          padding-left: 40px;
          font-size: 12px;
          padding-bottom: 15px;
          padding-top: 6px;
          color: #666;
          font-style: italic;
          padding-right: 15px;
        }

        :global(.dark) .info-txt {
          color: #999;
        }

        .freq_drop {
          border-top: 1px solid #bbb;
          padding: 10px 15px 0;
          font-size: 14px;
        }

        :global(.dark) .freq_drop {
          border-top-color: #555;
        }

        .freq_selected {
          position: relative;
          color: black;
        }

        :global(.dark) .freq_selected {
          color: white;
        }

        .freq_selected i {
          font-size: 20px;
          vertical-align: middle;
          color: black;
          margin-right: 5px;
        }

        :global(.dark) .freq_selected i {
          color: white;
        }

        .credits-display {
          margin: 15px 0;
          padding: 15px;
          background: #f9f9f9;
          border-radius: 5px;
          border: 1px solid #e0e0e0;
        }

        :global(.dark) .credits-display {
          background: #2a2a2a;
          border-color: #444;
        }

        .credits-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .credits-label {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #666;
        }

        :global(.dark) .credits-label {
          color: #999;
        }

        .credits-value {
          font-size: 16px;
          font-weight: 700;
          color: #3ab54b;
        }

        .credits-bar {
          width: 100%;
          height: 8px;
          background: #e0e0e0;
          border-radius: 4px;
          overflow: hidden;
        }

        :global(.dark) .credits-bar {
          background: #444;
        }

        .credits-progress {
          height: 100%;
          background: #3ab54b;
          transition: width 0.3s ease;
          border-radius: 4px;
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
          opacity: 0.5;
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

        :global(.dark) .guarantee {
          border-top-color: #333;
          border-bottom-color: #333;
        }

        .guarantee div {
          padding: 10px;
          font-size: 12px;
          color: black;
        }

        :global(.dark) .guarantee div {
          color: white;
        }

        .guarantee div.line {
          padding: 0;
          border-right: 1px solid #ddd;
        }

        :global(.dark) .guarantee div.line {
          border-right-color: #333;
        }

        .guarantee i {
          display: block;
          font-size: 25px;
          color: black;
          margin-bottom: 10px;
        }

        :global(.dark) .guarantee i {
          color: white;
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
