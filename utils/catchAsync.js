// catchAsync is more for the unexpected error, which we used to handle using try catch

module.exports = (fn) => (req, res, next) => {
  fn(req, res, next).catch(next);

  // simplified above
  // return (req, res, next) => {
  //   fn(req, res, next).catch((err) => next(err));
  // };
};
