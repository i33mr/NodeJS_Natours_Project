const mongoose = require("mongoose");
const slugify = require("slugify");
// const validator = require("validator");

const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "A tour must have a name"],
      unique: true,
      trim: true,
      maxlength: [40, "A tour name must be 40 character or less"],
      minlength: [10, "A tour name must be 10 character or more"],
      // validate: [validator.isAlpha, "A tour name must only contain characters"],
    },
    slug: String,
    duration: {
      type: Number,
      required: [true, "A tour must have a duration"],
    },
    maxGroupSize: {
      type: Number,
      required: [true, "A tour must have a max group size"],
    },
    difficulty: {
      type: String,
      required: [true, "A tour must have a difficulty"],
      enum: {
        values: ["easy", "medium", "difficult"],
        message: "Difficulty is either easy, medium, or difficult",
      },
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, "Rating must be above 1.0"],
      max: [5, "Rating must be below 5.0"],
      set: (val) => Math.round(val * 10) / 10, //4.6666, 46.666, 47
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, "A tour must have a price"],
    },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function (val) {
          // works only with creating document (this)
          return val < this.price;
        },
        message: `Discount price ({VALUE}) should be less that the actual price`,
      },
    },
    summary: {
      type: String,
      trim: true,
      required: [true, "A tour must have a summary"],
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String,
      required: [true, "A tour must have a cover image"],
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false,
    },
    startDates: [Date],
    secretTour: {
      type: Boolean,
      default: false,
    },
    startLocation: {
      // GeoJSON
      type: {
        type: String,
        default: "Point",
        enum: ["Point"],
      },
      // Longitude first, latitude second. unlike google maps
      coordinates: [Number],
      address: String,
      description: String,
    },
    locations: [
      {
        type: {
          type: String,
          default: "Point",
          enum: ["Point"],
        },
        coordinates: [Number],
        address: String,
        description: String,
        // the day of the tour that this tour will be visited
        day: Number,
      },
    ],
    guides: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// tourSchema.index({ price: 1 });
tourSchema.index({ price: 1, ratingsAverage: -1 });

tourSchema.index({ slug: 1 });

tourSchema.index({ startLocation: "2dsphere" });

tourSchema.virtual("durationWeeks").get(function () {
  return this.duration / 7;
});

// Virtual populate
tourSchema.virtual("reviews", {
  ref: "Review",
  foreignField: "tour", // Where the id of the document is stored in the foreign model (the id of the tour in the Review)
  localField: "_id", // Where the id of the document is stored in the this model (the id of the tour in the Tour)
});

// DOCUMENT MIDDLEWARE: runs before the .save() and .create and NOT ON insertMany() or UPDATE
tourSchema.pre("save", function (next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

// Embedding the user into  the tour is a bad idea, we are using referencing instead
// tourSchema.pre("save", async function (next) {
//   // You don't need the async/await inside the map function.
//   // If you don't await, it will return a promise anyways,
//   // and that promise will be saved on "guidesPromises".Then you just await them all.
//   // const guidesPromises = this.guides.map(async (id) => await User.findById(id));
//   // this.guides = await Promise.all(guidesPromises);

//   // This will prevent multiple DB calls
//   const ids = this.guides;
//   this.guides = await User.find({ _id: { $in: ids } });

//   next();
// });

// QUERY MIDDLEWARE
// a regexp to include any query that starts with "find"
tourSchema.pre(/^find/, function (next) {
  this.find({ secretTour: { $ne: true } });
  this.start = Date.now();
  next();
});

tourSchema.post(/^find/, function (docs, next) {
  // this.find({ secretTour: { $ne: true } });
  console.log(`Tour Query took ${Date.now() - this.start} milliseconds`);
  // console.log(docs);

  next();
});

tourSchema.pre(/^find/, function (next) {
  // populate: replace the fields we referenced with the actual related data. guides here = Users
  this.populate({
    path: "guides",
    select: "-__v -passwordChangedAt",
  });
  next();
});

// AGGREGATION MIDDLEWARE
// tourSchema.pre("aggregate", function (next) {
//   this.pipeline().unshift({
//     $match: { secretTour: { $ne: true } },
//   });
//   console.log(this);
//   next();
// });

const Tour = mongoose.model("Tour", tourSchema);

module.exports = Tour;
