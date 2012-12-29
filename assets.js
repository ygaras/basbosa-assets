var RequireJs = require('requirejs'), 
  Fs = require('fs'), 
  Crypto = require('crypto'), 
  Path = require('path');

// TODO:
// 2- Add support for watching files and rebuilding for all affected contexts
// 3- Investigate the delayed  first response 
// 4- Finish
var BasbosaAssets = function(options) {
  this.setOptions(options);
};
module.exports = BasbosaAssets;

BasbosaAssets.prototype = {

  options : {
    enableOpt : false,
  },
  
  contexts : {},
    
  setOptions : function(options) {
    options = options || {};
    for (var key in options) {
      this.options[key] = options[key]; 
    }
  },
  
  watchedFiles : [],
  
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
  
  flushCjs : function(context) {
    if (typeof context === 'undefined') context = 'default';
    if (!this.options.enableOpt) return this.flushJs(context); 
    
    if (!this.contexts[context].cjs) {
      this.processJs(context);
      return this.flushJs(context);
    }
    return this.contexts[context].cjs;
    
  },
  
  flushJs : function(context) {
    var res = '', length, jsCont;
    if (typeof context === 'undefined') context = 'default';
    this.assertContext(context);
    jsCont = this.contexts[context].js;
    length = jsCont.length; 
    for (var i = 0; i < length; i++) {
      res += '<script src="' + jsCont[i] + '"></script>';
    }
    return res;   
  },
  
  processJs : function(context) {
    var self = this;
    this.assertContext(context);
    this.options.include = this.contexts[context].js;
    var build = this.options;
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
    });   
  }
};