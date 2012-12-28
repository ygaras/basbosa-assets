var RequireJs = require('requirejs'), 
  Fs = require('fs'), 
  Crypto = require('crypto'), 
  Path = require('path');

module.exports = {

  options : {
    baseUrl : APP_PATH ,
    name : null, 
    out : PUBLIC_PATH + '/build/main',
    optimize : 'uglify',
  },
  
  contexts : { },
  
  init : function(options) {
    for (var key in this.options) {
      if (typeof options[key] !== 'undefined') this.options[key] = options[key]; 
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
      
      Fs.writeFile(target, contents);

      Fs.readdir(Path.dirname(target), function(err, files) {
        files.forEach(function(file) {
          // Delete all old build files
          //Basbosa('Logger').('checking file('
          file = Path.dirname(target) + '/' + file;
          if (file.indexOf(build.out) > -1 && file.indexOf(digest) == -1) {
            Basbosa('Logger').info('Deleting ' + file);
            Fs.unlink(file);
          }
        });
      });
      
      target = target.replace(build.baseUrl, '');
      self.contexts[context].cjs = '<script src="' + target + '"></script>';
      self.contexts[context].cjs.replace(build.baseUrl, '');

    });   
  }
};