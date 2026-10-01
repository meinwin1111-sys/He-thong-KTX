const errorHandler = (err, req, res, next) => {
    console.error(err); // Log the error for debugging

    // Determine the status code and message based on the error
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    // Send the response
    res.status(statusCode).json({
        status: 'error',
        statusCode: statusCode,
        message: message,
    });
};

module.exports = errorHandler;