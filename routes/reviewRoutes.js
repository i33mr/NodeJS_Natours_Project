const express = require("express");
const reviewController = require("../controllers/reviewController");
const authController = require("../controllers/authController");

// mergeParams will allow us to use the tourId received in the tourRoutes
//  POST /tour/234fad/reviews
//  GET /tour/234fad/reviews
//  POST /reviews
const router = express.Router({ mergeParams: true });

router.use(authController.protect);

router
  .route("/")
  .get(reviewController.getAllReviews)
  .post(
    authController.restrictTo("user"),
    reviewController.setTourUserIds,
    reviewController.createReview
  );

router
  .route("/:id")
  .get(reviewController.getReview)
  .patch(
    authController.restrictTo("user", "admin"),
    reviewController.checkAuthor,
    reviewController.updateReview
  )
  .delete(
    authController.restrictTo("user", "admin"),
    reviewController.checkAuthor,
    reviewController.deleteReview
  );

// No longer needed after having the virtual populate that lists the reviews in the tour model
// router.route("/tour/:id").get(reviewController.getTourReview);

module.exports = router;
