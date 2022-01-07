import axios from "axios";
import { showAlert } from "./alerts";

export const bookTour = async (tourId) => {
  try {
    const stripe = Stripe(
      "pk_test_51KEtyOD9mT7tMDmDo9EKinvN6KD7jjxWKMrBgmTIAfyGTrRRPjTrCyBrHH3Kwp8bmEtkExb8TeSoNBbuimgh5GIa00F4HT6BWH"
    );
    // 1) Get checkout session from API
    const session = await axios(
      `http://127.0.0.1:3000/api/v1/bookings/checkout-session/${tourId}`
    );
    // console.log(session);
    // 2) Get checkout form + charge credit card
    await stripe.redirectToCheckout({
      // .session.id is added by axios
      sessionId: session.data.session.id,
    });
  } catch (error) {
    showAlert("error", error);
    // console.log(erro)
  }
};
