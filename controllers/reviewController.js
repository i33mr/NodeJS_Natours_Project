const Review = require("../models/reviewModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const factory = require("./handlerFactory");

// The original one before handler factory moved to the bottom

// To create a review on a tour (retrieved from tourId), as a user (retrieved from req.user.id)
exports.setTourUserIds = (req, res, next) => {
  // Allow nested routes. Still allowing to select a user instead of using the req.user
  //  one from.protect!!!! ???? CONSIDER REMOVING IT
  if (!req.body.tour) req.body.tour = req.params.tourId;
  if (!req.body.user) req.body.user = req.user.id;
  // consider finding a better way to set the author and the tour, possible security flow
  next();
};

// Checking that the author of the tour is the one trying to delete/ update
exports.checkAuthor = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id);
  if (!review) {
    return next(new AppError("No document found with that ID", 404));
  }
  if (req.user.id !== review.user.id && req.user.role !== "admin") {
    return next(
      new AppError("You do not have permission to perform this action.", 403)
    );
  }
  next();
});

exports.getAllReviews = factory.getAll(Review);

exports.getReview = factory.getOne(Review);

exports.createReview = factory.createOne(Review);

exports.updateReview = factory.updateOne(Review);

exports.deleteReview = factory.deleteOne(Review);

// exports.deleteReview = catchAsync(async (req, res, next) => {
//   let review = await Review.findById(req.params.id);

//   // My own, checking if the review author the same as the logged-in user
//   if (req.user._id.toString() !== review.user._id.toString()) {
//     return next(new AppError("You can't delete this review"), 401);
//   }
//   review = await Review.findByIdAndDelete(req.params.id);

//   if (!review) {
//     return next(new AppError("No review found with that ID"), 404);
//   }

//   res.status(204).json({
//     status: "success",
//     data: null,
//   });
// });

// My own
// No longer needed after having the virtual populate that lists the reviews in the tour model

// exports.getTourReview = catchAsync(async (req, res, next) => {
//   const reviews = await Review.find({ tour: req.params.id });
//   if (!reviews) {
//     return next(new AppError("This tour has no reviews", 404));
//   }

//   res.status(200).json({
//     status: "success",
//     results: reviews.length,
//     data: {
//       reviews,
//     },
//   });
// });

// exports.getAllReviews = catchAsync(async (req, res, next) => {
//   // Get reviews for a specific tour (if the tourId was passed on the params)
//   let filter = {};
//   if (req.params.tourId) filter = { tour: req.params.tourId };
//   const reviews = await Review.find(filter);

//   res.status(200).json({
//     status: "success",
//     results: reviews.length,
//     data: {
//       reviews,
//     },
//   });
// });
