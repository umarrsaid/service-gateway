const _ = require("lodash");

class OutputJsonSender {
    constructor({ template, defaults, debugFields = [], filters = [], messages = {}, restrictErrors = true, messageField = "message" }) {
        this._res = null;
        this._originalSend = null;

        this._contentHandlers = [];
        this._messages = messages;
        
        this._setupFilters(filters);

        this._template = template;      

        this._fields = this._parseFieldsFromTemplate(template);
        this._defaults = defaults;
        this._debugFields = debugFields;
        this._messageField = messageField;
        
        this._restrictErrors = restrictErrors;
        
        this.dealWith(this._defaultFilter.bind(this));

        this._debugMode = process.env.LOG_LEVEL === "debug";
    }

    dealWith(handler) {
        this._contentHandlers.push(handler);
        return this;
    }

    response(res) {
        this._res = res;
        this._originalSend = res.send.bind(res);
    }

    return(data) {
        
        if(!this._res) {
            throw Error("Bad express response object");
        }

        let handlerData = null;

        for(let i=0; i < this._contentHandlers.length; ++i) {
            const handler = this._contentHandlers[i];

            if((handlerData = handler(data))) {
                break;
            }
            
            // Default filter always provide a handlerData            
        }

        return this._originalSend(this._jsonContent(this._handleErrorMessages(handlerData)));
    }

    _parseFieldsFromTemplate(template) {
        const templateObject = JSON.parse(template);
        
        const extra = {};
        const fields = {
            extra: extra 
        }; 
         
        Object.keys(templateObject).forEach(k => {
            const v = templateObject[k];

            if(typeof v === "string" && v.length > 0 && v[0] === "$") {
                const fieldName = v.substr(1);
                fields[fieldName] = k;
            } else {
                extra[k] = v; 
            }                
        }); 
        
        return fields;
    }    
    
    _setupFilters(filters) {
        filters.forEach(f => {

            if(f.regex) {
                this._setupRegexFilter(f);
            }

        });
    }

    _setupRegexFilter(filter) {
        this.dealWith(this._regexFilterType.bind(this, filter));
    }

    _regexFilterType(filter, data) {
        if(typeof data === "string") {

            const regex = new RegExp(filter.regex);
            const result = regex.exec(data);

            if(result) {

                const errorObject = _.pickBy(filter, (v, k) => k !== 'regex');                
                let message = errorObject[this._messageField] || this._defaults[this._messageField];
                
                message = message.replace(/\$(\d)/g, (match, arg) => result[arg]);
                errorObject[this._messageField] = [ true, message ];
                
                return this._buildErrorObject(errorObject);
            }
        }

        return null;
    } 

    _buildErrorObject(srcError = {}) {
        const errorObject = {};

        Object.keys(this._fields).forEach(sourceField => {

            if(sourceField === 'extra') return;
            
            const destField = this._fields[sourceField];

            if(!this._debugMode && this._debugFields.includes(destField)) return;
            
            const value = srcError[sourceField] || this._defaults[destField];
            
            errorObject[destField] = value;
        });
        
        if(typeof this._fields['extra'] === 'object') {
            Object.keys(this._fields['extra']).forEach(kE => {

                if(!this._debugMode && this._debugFields.includes(kE)) return;

                errorObject[kE] = this._fields['extra'][kE];
            });
        }
                
        if(this._debugMode) {
            
            const srcErrorOtherFieldKeys = Object.keys(srcError).filter(k => !Object.keys(this._fields).includes(k));

            srcErrorOtherFieldKeys.forEach(k => {
                if(typeof errorObject[k] === 'undefined') {                
                    errorObject[k] = srcError[k];
                }
            });            
        }

        return errorObject;
    }

    _defaultFilter(data) {

        if(typeof data === "string") {
            try {
                data = JSON.parse(data);                
            } catch(e) {
                // Whatever...
            }
        }
        
        if(typeof data === "object") {
            return this._buildErrorObject(data);
        }
        
        return this._buildErrorObject({
            message: data
        });
    }

    _handleErrorMessages(output) {
 
        let passThroughErrors = !this._restrictErrors;

        if(this._messageField) {

            // Usually a lot of error messages that are sent from the backend are of no interest to App developers, when building their error handling and notification UXs
            // However when returning a message from a filter we actually declare that as curated message to the app, that is why we're bypassing here
            
            if(output[this._messageField] instanceof Array && output[this._messageField][0] === true && typeof output[this._messageField][1] === "string") {
                passThroughErrors = true;
                output[this._messageField] = output[this._messageField][1];
            }
        }
        
        if(typeof output === "object" && output["status"] === "NOK") {
            output.message = this._messages[output.message] || (true === passThroughErrors && output.message) || this._defaultErrorMessage || output.message;
        }

        return output;
    }
    
    _jsonContent(data) {

        try {
        
            if(!this._res.headersSent) {        
                this._res.setHeader("Content-Type", "application/json");
            }
            
        } catch(e) {
            // Noop--need to figure out this, some times it will crash for headers being sent 
        }
            
        return JSON.stringify(data);
    }
}

module.exports = OutputJsonSender;
