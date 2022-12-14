const OutputJsonSender = require('./output_json_sender');

module.exports = {
    name: 'errors',
    schema: {
        $id: 'http://express-gateway.io/schemas/policies/errors.json', 
        type: 'object',
        properties: {

            template: {
                type: "string",                
                default: '{ "status": "$status", "message": "$message", "code": "$code", "exception": "$exception" }',
                description: "JSON structure error response template"
            },

            defaults: {
                type: "object",
                default: { status: "error", message: "Server Error" },
                description: "JSON fields defaults dictionary"
            },

            debugFields: {
                type: "array",
                items: {
                    type: "string"
                },
                description: "Fields to filter out in response when LOG_LEVEL is not DEBUG"
            },

            messageField: {
                type: "string",
                default: "message",
                description: "Field name where we expect the error message to be"
            },
            
            filters: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        regex: {
                            type: "string"
                        } 
                    }   
                },
                description: "List of message regex rules, that match and transform error messages"
            },
 
            messages: {   
                type: "object",
                description: "Message dictionary that maps proxied backend error messages to response curated messages"
            },
 
            restrictErrors: {  
                type: "boolean", 
                default: true,
                description: "Every proxied error message not specified in `messages` option is filtered out"
            }
        }
    },
    policy: (actionParams) => { 

        const output = new OutputJsonSender(actionParams);

        return (req, res, next) => {

            output.response(res); 

            // Monkey patch res.send
            
            res.send = new Proxy(res.send, {
                apply: (fn, thisArg, args) => {
                    
                    if(res.statusCode === 200) {
                        return fn.apply(res, args);
                    }
                    
                    return output.return(args[0]); 
                } 
            });    

            next();  
        }; 
    }
};
