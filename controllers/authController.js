const crypto = require("crypto");
const { promisify } = require("util");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const Email = require("../utils/email");

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const createAndSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    // secure: true,
    httpOnly: true,
  };
  if (process.env.NODE_ENV === "production") cookieOptions.secure = true;

  res.cookie("jwt", token, cookieOptions);

  // Remove the password from the output
  // REPLACED WITH MY MIDDLEWARE IN userModel. Update: still need it for login

  user.password = undefined;

  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  // A serious security flow!!
  // const newUser = await User.create(req.body);

  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    photo: req.body.photo, // recheck the photo part
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    passwordChangedAt: req.body.passwordChangedAt,
  });
  const url = `${req.protocol}://${req.get("host")}/me`;
  // console.log(url);
  await new Email(newUser, url).sendWelcome();
  createAndSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) check if email and password exist
  if (!email || !password) {
    return next(new AppError("Please provide email and password", 400));
  }
  // 2) check if user exist and password is correct
  const user = await User.findOne({ email }).select("+password");

  // console.log(req.body);
  // console.log(email, password);

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("Email or password are incorrect", 401));
  }
  // 3) if everything is ok, send token to client
  createAndSendToken(user, 200, res);

  // const token = signToken(user._id);

  // res.status(200).json({
  //   status: "ok",
  //   token: token,
  // });
});

exports.logout = (req, res) => {
  // to delete the jwt cookie (logout), we need to send an empty jwt cookie to replace it
  // and set the expiration date so close (10s)
  res.cookie("jwt", "logged out", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({ status: "success" });
};

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it exists
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.jwt && req.cookies.jwt !== "logged out") {
    token = req.cookies.jwt;
  }
  // console.log(token);

  if (!token) {
    return next(
      new AppError("You aren't logged in, please log in to get access", 401)
    );
  }
  // 2) Token verification, checking if the token payload have been manipulated
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError(
        "The user belonging to this token does no longer exist. ",
        401
      )
    );
  }

  // 4) Check if user changed password after the token was issued
  // if user changed the password after the token was issued, send an error
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError("User recently changed password! Please login again", 401)
    );
  }

  // GRANT ACCESS TO THE PROTECTED ROUTE
  req.user = currentUser;
  // put the user on locals to give the templates access to it
  res.locals.user = currentUser;

  next();
});

// Only for rendered pages, no errors!
exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      // 1) Verify token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );

      // 2) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      // 3) Check if user changed password after the token was issued
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      // THERE IS A LOGGED IN USER
      res.locals.user = currentUser;
      // return next(); not needed since the if statement will be exited anyways to the next()
    } catch (err) {
      return next();
    }
  }
  next();
};

// NO ASYNC SINCE WE'RE NOT ACCESSING TEH DB
exports.restrictTo =
  (...roles) =>
  // return (req, res, next) => {
  (req, res, next) => {
    // e.g. roles = ["admin", "lead-guide"]
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403)
      );
    }
    next();
  };

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on posted email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError("There is no user with that email address", 404));
  }

  // 2) Generate the random token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // since we need to do more that sending an error, then we need to use try catch block
  try {
    // 3) Send it to user's email
    const resetURL = `${req.protocol}://${req.get(
      "host"
    )}/api/v1/users/resetPassword/${resetToken}`;

    await new Email(user, resetURL).sendPasswordReset();
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        "There was an error sending the email, try again later!",
        500
      )
    );
  }
  res.status(200).json({
    status: "success",
    message: "Token sent to email!",
  });
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: {
      $gt: Date.now(),
    },
  });

  // 2) if token has not expired, and there is user, set new password
  if (!user) {
    return next(new AppError("Token is invalid or has expired.", 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();
  // 3) Update changePasswordAt property for the user (in userModel, document middleware)

  // 4) Log the user in, send JWT
  createAndSendToken(user, 200, res);

  // const token = signToken(user._id);

  // res.status(200).json({
  //   status: "success",
  //   token: token,
  // });
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  // const {user} = req;
  // since password select: false, we have to explicity select it
  const user = await User.findById(req.user._id).select("+password");
  // 2) check if posted password is correct
  // console.log(user);
  // if (
  //   !req.body.password ||
  //   !req.body.passwordConfirm ||
  //   !req.body.newPassword
  // ) {
  //   return next(new AppError("Please provide the required information", 400));
  // }
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError("Your current password is wrong.", 401));
  }
  // 3) if so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  // 4) log user in, send JWT.
  createAndSendToken(user, 200, res);

  // const token = signToken(user._id);
  // res.status(200).json({
  //   status: "success",
  //   token,
  // });
});
