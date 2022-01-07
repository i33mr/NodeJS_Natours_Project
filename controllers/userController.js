const multer = require("multer");
const sharp = require("sharp");
const User = require("../models/userModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const factory = require("./handlerFactory");

// cd is like the next function from express, we called it cb since it is not from express

// Changed to memoryStorage in order to process the image before saving it.
// const multerStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, "public/img/users");
//   },
//   filename: (req, file, cb) => {
//     // filename: user-459734957934675-584.jpeg
//     // ext: file extension
//     const ext = file.mimetype.split("/")[1];
//     cb(null, `user-${req.user.id}-${Date.now()}.${ext}`);
//   },
// });

// Changed to memoryStorage in order to process the image before saving it.
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

// photo is the name of the field in the form that will upload the image
exports.uploadUserPhoto = upload.single("photo");

exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next();

  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;

  await sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat("jpeg")
    .jpeg({ quality: 90 })
    .toFile(`public/img/users/${req.file.filename}`);

  next();
});

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};
// for user to update their data
exports.updateMe = catchAsync(async (req, res, next) => {
  // console.log(req.file);
  // console.log(req.body);
  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        "This route isn't for password updates, please use /updateMyPassword.",
        400
      )
    );
  }

  // 2) Update user document
  // req.body.role:"admin" XXXX
  const filteredBody = filterObj(req.body, "name", "email");
  if (req.file) filteredBody.photo = req.file.filename; // saving the photo name to the database
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });
  // user.name = "jonas";
  // await user.save();
  // console.log(updatedUser);
  // res.locals.user = updatedUser;

  res.status(200).json({
    status: "success",
    data: {
      user: updatedUser,
    },
  });
  // res.status(200).render("account", {
  //   title: "Your Account",
  //   user: updatedUser, // we can also use res.locals.user = updatedUser before sending the response
  // });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });

  res.status(204).json({
    status: "success",
    data: null,
  });
});

exports.createUser = (req, res) => {
  res.status(500).json({
    status: "error",
    message: "This route is not defined, please use /signup instead",
  });
};

exports.getUser = factory.getOne(User);

exports.getAllUsers = factory.getAll(User);

// only for admins, user can use deleteMe, which will deactivate the account
// Do NOT update passwords with this
exports.updateUser = factory.updateOne(User);

// only for admins, user can use deleteMe, which will deactivate the account
exports.deleteUser = factory.deleteOne(User);
