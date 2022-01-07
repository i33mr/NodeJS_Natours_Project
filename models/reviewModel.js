const mongoose = require("mongoose");
const Tour = require("./tourModel");

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, "Review can not be empty"],
    },
    rating: {
      type: Number,
      // enum: [1, 2, 3, 4, 5],
      min: 1,
      max: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now(),
      // my input. to avoid changing it
      // immutable: true,
    },
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: "Tour",
      required: [true, "Review must belong to a tour."],
      // my input. to avoid changing it
      immutable: true,
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "Review must belong to a user."],
      // my input. to avoid changing it
      immutable: true,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

reviewSchema.index({ tour: 1, user: 1 }, { unique: true });

// QUERY MIDDLEWARE
// reviewSchema.pre(/^find/, function (next) {
//   // this.populate({
//   //   path: "tour",
//   //   select: "-guides name", // explicitly removing the guides because they were populated in the tour model
//   // }).populate({
//   //   path: "user",
//   //   select: "name photo",
//   // });
//   // Removed the tour populating since it creates populate chain which affects the performance, and it is not even reasonable to have in the first place
//   this.populate({
//     path: "user",
//     select: "name photo",
//   });
//   next();
// });

reviewSchema.statics.calcAverageRatings = async function (tourId) {
  console.log(tourId);
  const stats = await this.aggregate([
    {
      $match: { tour: tourId },
    },
    {
      $group: {
        _id: "$tour",
        nRating: { $sum: 1 },
        averageRating: { $avg: "$rating" },
      },
    },
  ]);
  // console.log(stats);

  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].averageRating,
    });
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5, // The default
    });
  }
};

reviewSchema.post("save", function (next) {
  // this.constructor = The Review model, Which isn't created yet, but that is a method to reach it
  this.constructor.calcAverageRatings(this.tour);
  // next(); //post middleware doesn't have next function
});

// reviewSchema.pre(/^findOneAnd/, async function (next) {
//   // how to get the document inside a query middleware?
//   //  By executing the query, which returns the document that is being processed
//   // r = review

//   this.r = await this.findOne();
//   // console.log(this.r);
//   next();
// });

// reviewSchema.post(/^findOneAnd/, async function () {
//   // await this.findOne(); does not work here, query has already executed
//   await this.r.constructor.calcAverageRatings(this.r.tour);
// });

//  the pre middleware of findOneAnd  is not needed.
// Post middleware will get the doc as the first argument.
// Still IMPORTANT to read the code above to understand the whole concept of moving a document form pre to post middleware

reviewSchema.post(/^findOneAnd/, async (doc) => {
  await doc.constructor.calcAverageRatings(doc.tour);
});

const Review = mongoose.model("Review", reviewSchema);

module.exports = Review;
