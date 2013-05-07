var RequireJs = require('requirejs'), 
  Fs = require('fs'), 
  Crypto = require('crypto'), 
  Path = require('path');

var BasbosaAssets = function(requireJsOptions, extraOptions) {
  // Initialize the default state of enabling compression based on current environment
  var env = process.env.NODE_ENV || 'development';

  // if Basbosa is loaded
  if (typeof Basbosa !== 'undefined') {
    env = Basbosa('Config').get('env');
  }

  extraOptions = extraOptions || {};
  extraOptions.enabled = (env.indexOf('production') > -1);
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
 
  js : function(path, context, assetType) {
    if (typeof context === 'undefined') context = 'default';
    if (typeof assetType === 'undefined') assetType = 'js';
    var watchedToken = path + '.' + assetType  + ':' + context;
    //  If file already exists, just return
    if (this.watchedFiles[watchedToken]) {
     return;
    } else {
     if (typeof this.contexts[context] === 'undefined') this.createContext(context);
     this.contexts[context][assetType].push(path);
     this.watchedFiles[watchedToken] = 1;
    }
  },
  
  css : function(path, context) {
    return this.js(path, context, 'css');
  },
  
  flushCjs : function(context, cb, assetType) {
    var assetClass;
    if (typeof context === 'function') {
      cb = context;
      context = 'default';
    }
    if (typeof assetType === 'undefined') assetType = 'js';
    if (typeof context === 'undefined') context = 'default';
    
    assetClass = assetType.charAt(0).toUpperCase() + assetType.slice(1);;
        
    if (!this.extraOptions.enabled) {
      return this['flush' + assetClass](context, cb);
    }
    
    // If no compressed asset file is ready for this context, create one
    if (!this.contexts[context]['c' + assetType]) {
      return this['process' + assetClass](context, cb);
    }
    
    cb(this.contexts[context]['c' + assetType]);
    return this.contexts[context]['c' + assetType]; 
  },
  
  flushCcss : function(context, cb) {
    return this.flushCjs(context, cb, 'css');
  },
  
  flushJs : function(context, cb) {
    var res = '', length, jsCont;
   
    if (typeof context === 'undefined') context = 'default';
    this.assertContext(context);
    jsCont = this.contexts[context].js;
    length = jsCont.length; 
    for (var i = 0; i < length; i++) {
      res += '<script src="' + jsCont[i] + '.js"></script>';
    }
    cb(res);
    return res;   
  },
  
  flushCss : function(context, cb) {
    var res = '', length, cssCont;
    
    if (typeof context === 'undefined') context = 'default';
    this.assertContext(context);
    cssCont = this.contexts[context].css;
    length = cssCont.length; 
    for (var i = 0; i < length; i++) {
      res += '<link rel="stylesheet" href="' + cssCont[i] + '.css">';
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
    
    build.include.forEach(function(jsFile, index) {
      build.include[index] += context == 'css' ? '.css' : '.js';
    });
    
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
      
      target = target.replace(build.baseUrl, '/');
      self.contexts[context].cjs = '<script src="' + target + '"></script>';
      cb(self.contexts[context].cjs);
    });   
  },
  
  processCss : function(context, cb) {
    var self = this, i, contents = '', cssFiles, target, md5sum, digest;
    this.assertContext(context);
    cssFiles = this.contexts[context].css;
    
    for (i = 0; i < cssFiles.length; i++) {
      contents += Fs.readFileSync(this.requireJsOptions.baseUrl + '/' + cssFiles[i] + '.css');
    }
  
    md5sum = Crypto.createHash('md5');
    md5sum.update(contents);
    digest = md5sum.digest('hex');
    
    target = this.requireJsOptions.outCss + '-' + digest + '.css';
    Fs.writeFileSync(target, contents) ; 
    
    Fs.readdir(Path.dirname(target), function(err, files) {
      files.forEach(function(file) {
        // Delete all old build files
        file = Path.dirname(self.requireJsOptions.outCss) + '/' + file;
        if (file.indexOf(self.requireJsOptions.outCss) > -1 && file.indexOf(digest) == -1) {
          Fs.unlink(file, function(err) {
            if (err) throw err;
          });
        }
      });
    });
    
    target = target.replace(self.requireJsOptions.baseUrl, '');
    self.contexts[context].ccss = '<link rel="stylesheet" href="' + target + '">';
    cb(self.contexts[context].ccss);
  },
  
  
};