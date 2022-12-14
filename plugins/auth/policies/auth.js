
require('dotenv').config()
var fs = require('fs');
var jwt = require('jsonwebtoken');

module.exports = {
  name: "auth",
  policy: (actionParams) => {
    const that = this;
    return async (req, res, next) => {
      try {
        const auth = req?.headers?.authorization;
        
        if (!auth) {
          return res.status(400).send({
            status: 400,
            message: 'Invalid Authorization'
          });
        }
        const _auth = auth.trim().split(/ (.*)/s);

        const authType = _auth[0];
        const token = _auth[1];

        if (authType !== "Bearer") {
          return res.status(400).send({
            status: 400,
            message: 'Invalid Authorization'
          });
        }
          
        jwt.verify(token, process.env.AUTH_SECRET, function(err, payload) {
          if (err) {
            return res.status(401).send({
              status: 401,
              message: 'Unauthorized',
              result: err
            });
          }
          req.headers.user = payload.auth.id;
          req.headers.data = payload.auth;
          
          next();
        });
      } catch (error) {
        return res.status(400).send({
          status: 400,
          message: 'Internal server error',
          result: error
        });
      }
    };
  },
};
