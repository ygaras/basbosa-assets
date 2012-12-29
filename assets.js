var RequireJs = require('requirejs'), 
  Fs = require('fs'), 
  Crypto = require('crypto'), 
  Path = require('path');

var BasbosaAssets = function(requireJsOptions, extraOptions) {
  // Initialize the default state of enabling compression based on current environment
  var env = process.env.NODE_ENV || 'development';
  extraOptions = extraOptions || {};
  extraOptions.enabled = (env != 'development');
  this.options(requireJsOptions, extraOptions);
};

module.exports = BasbosaAssets;

BasbosaAssets.prototype = {

  extraOptions : {
    includeRequireJs : false,
    includeAlmond : false,
    enabled : false,
  },
  
  
  requireJsOptions : {
    
  },
  
  contexts : {},
  
  watchedFiles : [],
    
  options : function(requireJsOptions, extraOptions) {
    requireJsOptions = requireJsOptions || {};
    extraOptions = extraOptions || {};
    
    for (var key in requireJsOptions) {
      this.requireJsOptions[key] = requireJsOptions[key]; 
    }
    
    for (var key in extraOptions) {
      this.extraOptions[key] = extraOptions[key]; 
    }
    
    return {
      requireJsOptions : this.requireJsOptions,
      extraOptions : this.extraOptions
      
    };
  },
   
  createContext : function(context) {
    this.contexts[context] = {
      js : [],
      css : [],
      cjs : false,
      ccss : false,
     };
  },
 
  assertContext : function(context) {
    if (typeof this.contexts[context] === 'undefined') {
      throw new Error('Undefined context ' + context);
    }
  },
 
  cjs : function(path, context) {
    if (typeof context === 'undefined') context = 'default';
    //  If file already exists, just return
    if (this.watchedFiles[path + ':' + context]) {
     return;
    } else {
     if (typeof this.contexts[context] === 'undefined') this.createContext(context);
     this.contexts[context].js.push(path);
     this.watchedFiles[path + ':' + context] = 1;
    }
  },
  
  flushCjs : function(context, cb) {
    if (typeof context === 'function') {
      cb = context;
      context = 'default';
      
    }
    if (typeof context === 'undefined') context = 'default';
    
    if (!this.extraOptions.enabled) {
      return this.flushJs(context, cb);
    }
    
    // If no compressed js file is ready for this context, create one
    if (!this.contexts[context].cjs) {
      return this.processJs(context, cb);
    }
    
    cb(this.contexts[context].cjs);
    return this.contexts[context].cjs;
    
  },
  
  flushJs : function(context, cb) {
    var res = '', length, jsCont;
    if (typeof context === 'undefined') context = 'default';
    this.assertContext(context);
    jsCont = this.contexts[context].js;
    length = jsCont.length; 
    for (var i = 0; i < length; i++) {
      res += '<script src="' + jsCont[i] + '"></script>';
    }
    cb(res);
    return res;   
  },
  
  processJs : function(context, cb) {
    var self = this, build = {};
    this.assertContext(context);
    
    // make copy of current options of requireJsOptions
    for (var key in this.requireJsOptions) {
      build[key] = this.requireJsOptions[key];
    }
    build.include = this.contexts[context].js;
    
    Basbosa('Logger').debug('Optimizing js for context :'  + context);
    
    RequireJs.optimize(build, function(buildResponse) {
      var digest, target, contents = Fs.readFileSync(build.out, 'utf8'),
        md5sum = Crypto.createHash('md5');

      md5sum.update(contents);
      digest = md5sum.digest('hex');
      target = build.out + '-' + digest + '.js';
      if (!build.name) {
        contents = 'define=function(){};' + contents;
      }
      
      Fs.writeFileSync(target, contents);

      Fs.readdir(Path.dirname(target), function(err, files) {
        files.forEach(function(file) {
          // Delete all old build files
          file = Path.dirname(build.out) + '/' + file;
          if (file.indexOf(build.out) > -1 && file.indexOf(digest) == -1) {
            Fs.unlink(file, function(err) {
              if (err) throw err;
            });
          }
        });
      });
      
      target = target.replace(build.baseUrl, '');
      self.contexts[context].cjs = '<script src="' + target + '"></script>';
      cb(self.contexts[context].cjs);
    });   
  }
};