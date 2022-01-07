const multer = require("multer");
const sharp = require("sharp");

const Tour = require("../models/tourModel");
// const APIFeatures = require("../utils/apiFeatures");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const factory = require("./handlerFactory");

// memoryStorage in order to process the image before saving it to the file system.

const multerStorage = multer.memoryStorage();

// To test the file type, here we need an image
const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new AppError("Not an image, please upload images only", 400), true);
  }
};

// used to upload image from the user to the file system
const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadTourImages = upload.fields([
  {
    name: "imageCover",
    maxCount: 1,
  },
  {
    name: "images",
    maxCount: 3,
  },
]);

// upload.arry("images",3)

exports.resizeTourImages = catchAsync(async (req, res, next) => {
  if (!req.files.imageCover || !req.files.images) return next();

  // 1) Processing cover image

  // putting the name on req.body for it to be updated using updateTour (updateOne)
  req.body.imageCover = `tour-${req.params.id}-${Date.now()}-cover.jpeg`;
  await sharp(req.files.imageCover[0].buffer)
    .resize(2000, 1333)
    .toFormat("jpeg")
    .jpeg({ quality: 90 })
    .toFile(`public/img/tours/${req.body.imageCover}`);

  req.body.images = [];

  await Promise.all(
    req.files.images.map(async (file, i) => {
      const filename = `tour-${req.params.id}-${Date.now()}-${i + 1}.jpeg`;
      sharp(req.files.images[i].buffer)
        .resize(2000, 1333)
        .toFormat("jpeg")
        .jpeg({ quality: 90 })
        .toFile(`public/img/tours/${filename}`);

      req.body.images.push(filename);
    })
  );

  // 2) Processing other images

  next();
});

exports.aliasTopTours = (req, res, next) => {
  req.query.limit = "5";
  req.query.sort = "-ratingsAverage,price";
  req.query.fields = "name,price,ratingsAverage,summary,difficulty";
  next();
};

// Moved the original one before handler factory to the bottom
exports.getAllTours = factory.getAll(Tour);

// Moved the original one before handler factory to the bottom
exports.getTour = factory.getOne(Tour, { path: "reviews" });

exports.createTour = factory.createOne(Tour);
exports.updateTour = factory.updateOne(Tour);
// Moved the original deleteTour to the bottom
exports.deleteTour = factory.deleteOne(Tour);

exports.getTourStats = catchAsync(async (req, res, next) => {
  const stats = await Tour.aggregate([
    {
      $match: { ratingsAverage: { $gte: 4.5 } },
    },
    {
      $group: {
        _id: { $toUpper: "$difficulty" },
        // _id: "$ratingsAverage",
        numTours: { $sum: 1 },
        numRatings: { $sum: "$ratingsQuantity" },
        avgRating: { $avg: "$ratingsAverage" },
        avgPrice: { $avg: "$price" },
        minPrice: { $min: "$price" },
        maxPrice: { $max: "$price" },
      },
    },
    {
      $sort: {
        avgPrice: 1,
      },
    },
    // {
    //   $match: { _id: { $ne: "EASY" } },
    // },
  ]);
  res.status(200).json({
    status: "success",
    data: {
      stats,
    },
  });
});

exports.getMonthlyPlan = catchAsync(async (req, res, next) => {
  const { year } = req.params;

  const plan = await Tour.aggregate([
    {
      $unwind: "$startDates",
    },
    {
      $match: {
        startDates: {
          $gte: new Date(`${year}-01-01`),
          $lt: new Date(`${year}-12-31`),
        },
      },
    },
    {
      $group: {
        _id: { $month: "$startDates" },
        numTourStart: { $sum: 1 },
        tours: { $push: "$name" },
      },
    },
    {
      $sort: { numTourStart: -1 },
    },
    // needs a mongodb upgrade for it to work
    // {
    //   $addField: { month: "$_id" },
    // },
    {
      $project: {
        // _id: 0,
        month: "$_id",
        tours: 1,
      },
    },
    {
      $limit: 12,
    },
  ]);
  res.status(200).json({
    status: "success",
    results: plan.length,
    data: {
      plan,
    },
  });
});

// "/tours-within/:distance/center/:latlng/unit/:unit",
// "/tours-within/233/center/34.11,-118.113/unit/mi",

exports.getTourWithin = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params;
  const [lat, lng] = latlng.split(",");

  // calculation: we need to find the radius in radians to use it the mongoose query, radius = distance/ the radius of earth
  const radius = unit === "mi" ? distance / 3963.2 : distance / 6378.1;

  if (!lat || !lng) {
    return next(
      new AppError(
        "Please provide latitude and longitude into format lat,lng",
        400
      )
    );
  }

  const tours = await Tour.find({
    startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } },
  });

  console.log(distance, lat, lng, unit);

  res.status(200).json({
    status: "success",
    results: tours.length,
    data: {
      data: tours,
    },
  });
});

exports.getDistances = catchAsync(async (req, res, next) => {
  const { latlng, unit } = req.params;
  const [lat, lng] = latlng.split(",");

  const multiplier = unit === "mi" ? 0.000621371 : 0.001;
  if (!lat || !lng) {
    return next(
      new AppError(
        "Please provide latitude and longitude into format lat,lng",
        400
      )
    );
  }
  const distances = await Tour.aggregate([
    {
      // geoNear must always be the first, and it requires at least one of the model fields contains geospatial index
      // if one field only has the geospatial index, then geoNear will automatically use it. if we have multiple fields, then we need to specify which one using the keys parameter
      $geoNear: {
        near: {
          type: "Point",
          coordinates: [lng * 1, lat * 1],
        },
        distanceField: "distance",
        distanceMultiplier: multiplier,
      },
    },
    {
      $project: {
        distance: 1,
        name: 1,
      },
    },
  ]);
  res.status(200).json({
    status: "success",
    data: {
      data: distances,
    },
  });
});

// OLD CREATE TOUR
// exports.createTour = (req, res) => {
//   const newId = tours[tours.length - 1].id + 1;
//   // const newTour = Object.assign({ id: newId }, req.body);
//   const newTour = { id: newId, ...req.body };

//   tours.push(newTour);
//   // console.log(tours);

//   fs.writeFile(
//     `${__dirname}/../dev-data/data/tours-simple.json`,
//     JSON.stringify(tours),
//     (err) => {
//       if (err) return console.log(err);
//       res.status(201).send({
//         status: "success",
//         data: {
//           tour: newTour,
//         },
//       });
//     }
//   );
//   // res.send("Done");
// };

// USED TO READ THE DATA FROM JSON FILE
// const tours = JSON.parse(
//   fs.readFileSync(`${__dirname}/../dev-data/data/tours-simple.json`)
// );

// WAS USED TO CHECK THAT THE REQUIRED ELEMENTS IN THE REQ BODY EXIST, MONGODB CAN DO IT BETTER
// exports.checkBody = (req, res, next) => {
//   if (!req.body.name || !req.body.price) {
//     return res.status(400).json({
//       status: "fail",
//       message: "Missing name or price",
//     });
//   }
//   next();
//   // console.log(req);
// };

// ////////
// ORIGINAL API FEATURES
// // 1A) Filtering
// const queryObj = { ...req.query };
// const excludedFields = ["page", "sort", "limit", "fields"];
// excludedFields.forEach((el) => delete queryObj[el]);

// // 1B) Advanced filtering
// let queryStr = JSON.stringify(queryObj);
// queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

// let query = Tour.find(JSON.parse(queryStr));

// 2) SORTING
// if (req.query.sort) {
//   const sortBy = req.query.sort.split(",").join(" ");
//   query = query.sort(sortBy);
// } else {
//   query = query.sort("-createdAt _id");
// }

// 3) FIELD LIMITING
// if (req.query.fields) {
//   const fields = req.query.fields.split(",").join(" ");
//   query = query.select(fields);
// } else {
//   // query = query.sort("-createdAt");
//   query = query.select("-__v");
// }

// 4) PAGINATION
// const page = req.query.page * 1 || 1;
// const limit = req.query.limit * 1 || 100;
// const skip = (page - 1) * limit;

// query = query.skip(skip).limit(limit);
// // handling if the page number exceeds what should be
// if (req.query.page) {
//   const numTours = await Tour.countDocuments();
//   if (skip >= numTours) {
//     throw new Error("This page doesn't exist");
//   }
// }
// const tours = await query;

// //////
// exports.deleteTour = catchAsync(async (req, res, next) => {
//   const tour = await Tour.findByIdAndDelete(req.params.id);

//   if (!tour) {
//     return next(new AppError("No tour found with that ID", 404));
//   }

//   res.status(204).json({
//     status: "success",
//     data: null,
//   });
// });

// exports.getTour = catchAsync(async (req, res, next) => {
//   const tour = await Tour.findById(req.params.id).populate({
//     path: "reviews",
//     // select: "-tours",
//   });

//   if (!tour) {
//     return next(new AppError("No tour found with that ID", 404));
//   }

//   res.status(200).json({
//     status: "success",
//     data: {
//       tour,
//     },
//   });
// });

// exports.getAllTours = catchAsync(async (req, res, next) => {
//   // try {
//   // BUILD QUERY
//   // MOVED THE ORIGINAL CODE BEFORE THE apiFeatures CLASS TO THE BOTTOM

//   // EXECUTE QUERY
//   const features = new APIFeatures(Tour.find(), req.query)
//     .filter()
//     .sort()
//     .limitFields()
//     .paginate();
//   const tours = await features.query;
//   // const tours = await query;

//   // const query = Tour.find()
//   //   .where("duration")
//   //   .equals(5)
//   //   .where("difficulty")
//   //   .equals("easy");

//   // SEND RESPONSE
//   res.status(200).json({
//     status: "success",
//     results: tours.length,
//     data: {
//       tours: tours,
//     },
//   });
//   // } catch (error) {
//   //   res.status(404).json({
//   //     status: "fail",
//   //     message: error,
//   //   });
//   // }
// });
