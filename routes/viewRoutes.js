const express = require("express");
const viewController = require("../controllers/viewController");
const authController = require("../controllers/authController");

// temp
const bookingController = require("../controllers/bookingController");

const router = express.Router();

// router.get("/", (req, res) => {
//   res.status(200).render("base", {
//     tour: "The Forest Hiker",
//     user: "Omar",
//   });
// });

// Since we are using the protect function, we don't need to check if the user is logged in, since protect will do.
router.get("/me", authController.protect, viewController.getAccount);
router.post(
  "/submit-user-data",
  authController.protect,
  viewController.updateUserData
);
router.get("/my-tours", authController.protect, viewController.getMyTours);

// Checks if a user is logged in. to render different parts of the website depending on that
router.use(authController.isLoggedIn);

router.get(
  "/",
  bookingController.createBookingCheckout, //Temporary, everyone can make bookings without paying
  viewController.getOverview
);
router.get("/tour/:slug", viewController.getTour);
router.get("/login", viewController.getLoginForm);

module.exports = router;
