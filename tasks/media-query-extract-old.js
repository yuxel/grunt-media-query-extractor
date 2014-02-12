/*
* grunt-media-query-extractor
* https://github.com/bjork24/grunt-media-query-extractor
*
* Copyright (c) 2014 Dan Chilton
* Licensed under the MIT license.
*/

'use strict';

module.exports = function(grunt) {

  grunt.registerMultiTask('mqe', 'Combine and extract media queries for mobile-first responsive design', function() {

    var parseCss = require('css-parse');
    var path = require('path');
    var error = true;

    var options = this.options({
      log: true
    });

    var log = function(message){
      if (options.log){
        grunt.log.writeln(message);
      }
    };

    var process = {
      comment : function(comment) {
        var commentStr = '/*' + comment.comment + '*/';
        return commentStr + '\n';
      },
      declaration : function(declaration) {
        var declarationStr = declaration.property + ': ' + declaration.value + ';';
        return declarationStr;
      },
      media : function(media) {
        var mediaStr = '';
        mediaStr += '@media ' + media.rule + ' {\n\n';
        media.rules.forEach(function(rule) {
          mediaStr += process.commentOrRule(rule);
        });
        mediaStr += '}\n\n';
        log('@media ' + media.rule + ' - ' + media.rules.length + ' rules');
        return mediaStr;
      },
      keyframes : function(key) {
        var keyframeStr = '';
        keyframeStr += '@' + (typeof key.vendor !=='undefined'? key.vendor: '') + 'keyframes ' + key.name + ' {\n\n';
        key.keyframes.forEach(function(keyframe) {
          keyframeStr += process.commentOrKeyframe(keyframe);
        });
        keyframeStr += '}\n\n';
        return keyframeStr;
      },
      rule : function(rule) {
        var ruleStr = '';
        ruleStr += rule.selectors.join(',\n') + ' {';
        rule.declarations.forEach(function(rules) {
          ruleStr += process.commentOrDeclaration(rules);
        });
        ruleStr += '\n}\n\n';
        return ruleStr;
      },
      commentOrDeclaration : function(declarations) {
        var strCss = '';
        if( declarations.type === 'declaration' ){
          strCss += '\n\t' + process.declaration(declarations);
        } else if( declarations.type === 'comment' ){
          strCss += process.comment(declarations);
        }
        return strCss;
      },
      commentOrRule : function(rule) {
        var strCss = '';
        if ( rule.type === 'rule' ) {
          strCss += process.rule(rule);  
        } else if ( rule.type === 'comment' ) {
          strCss += process.comment(rule);
        }
        return strCss;
      },
      commentOrKeyframe : function(frame) {
        var strCss = '';
        if ( frame.type === 'keyframe' ) {
          strCss += frame.values.join(',') + ' {';
          frame.declarations.forEach(function (declaration) {
            strCss += process.commentOrDeclaration(declaration);
          });
          strCss += '\n}\n\n';
        } else if ( frame.type === 'comment' ){
          strCss += process.comment(frame);
        }
        return strCss;
      }
    };

    this.files.forEach(function(f) {

      f.src.forEach(function (filepath) {

        error = false;

        grunt.log.ok('File ' + filepath + ' found');

        var destpath = f.dest;
        var filename = filepath.replace(/(.*)\//gi, '');

        if ( destpath.indexOf(filename) === -1 ) {
          destpath = path.join(f.dest, filename);
        }

        var source = grunt.file.read(filepath);
        var cssJson = parseCss(source);

        var strStyles = '';
        var baseStyles = '';
        var keyframeStyles = '';
        var processedCSS = {
          base : [],
          media : [],
          keyframes : []
        };

        var output = {
          base : function(base, callback){
            base.forEach(function (rule) {
              baseStyles += process.commentOrRule(rule);
            });
            callback();
          },
          media : function(media){
            media.forEach(function(item){
              var mediaStyles = '';
              mediaStyles += process.media(item);
              output.writeToFile(item.val, mediaStyles);
            });
          },
          keyframes : function(keyframes, callback){
            keyframes.forEach(function (keyframe) {
              keyframeStyles += process.keyframes(keyframe);
            });
            callback();
          },
          writeToFile : function(appendToFileName, stylesToWrite){
            var file = destpath.replace('.css','-' + appendToFileName + '.css');
            var styles = grunt.util.normalizelf(stylesToWrite);
            grunt.file.write(file, styles);
            grunt.log.ok(file + ' written successfully');
          }
        };

        cssJson.stylesheet.rules.forEach(function(rule) {

          // media, rule, comment, keyframe = rule.type

          // if the rule is a media query...
          if (rule.type === 'media') {

            // Create 'id' based on the query (stripped from spaces and dashes etc.)
            var strMedia = rule.media.replace('(','').replace(')','').replace(' ','').replace(':','-');

            // Create an array with all the media queries with the same 'id'
            var item = processedCSS.media.filter(function (element) {
              return (element.val === strMedia);
            });

            // If there are no media queries in the array, define details
            if (item.length < 1) {
              var mediaObj = {};
              mediaObj.sortVal = parseFloat(rule.media.match( /\d+/g ));
              mediaObj.rule = rule.media;
              mediaObj.val = strMedia;
              mediaObj.rules = [];
              processedCSS.media.push(mediaObj);
            }

            // Compare the query to other queries
            var i = 0;
            processedCSS.media.forEach(function (elm) {
              if (elm.val !== strMedia) { i++; }
            });

            // Push every merged query
            rule.rules.forEach(function (mediaRule) {
              if (mediaRule.type === 'rule' || 'comment' ) {
                processedCSS.media[i].rules.push(mediaRule); 
              }              
            });

          } else if (rule.type === 'keyframes') {
            processedCSS.keyframes.push(rule); 
          } else if (rule.type === 'rule' || 'comment') {
            processedCSS.base.push(rule);
          }

        });

        // Sort media.minWidth queries ascending
        processedCSS.media.sort(function(a,b){
          return a.sortVal-b.sortVal;
        });

        // Check if base CSS was processed and print them
        if (processedCSS.base.length){
          output.base(processedCSS.base, function(){
            output.writeToFile('base', baseStyles);
          });
        }

        // Check if media queries were processed and print them in order     
        if (processedCSS.media.length){
          log('\nProcessed media queries:');
          output.media(processedCSS.media);
          log('');
        }

        // Check if keyframes were processed and print them               
        if (processedCSS.keyframes.length){
          output.keyframes(processedCSS.keyframes, function(){
            output.writeToFile('keyframes', keyframeStyles);
          });
        }

      });

if ( error ) {
  grunt.fatal('No files found');
}

});

});

};