'use strict';

var through = require('through2'),
  glob = require('glob-all'),
  path = require('path');

var import_template = {
  css: '<link href="__replacement__" rel="stylesheet" type="text/css"/>',
  js: '<script type="text/javascript" src="__replacement__"></script>'
};

/**
 * “引入”
 * @param  {string} dest_path 编译后的html文件输出目录
 * @param  {object} params    一个对象的引用，用于接收从html中抽取出来的数据
 * @return {through}          一个gulp的stream
 */
module.exports = function(options, params) {

  var JS_IMPORT_REG = /<!--\s*import:js\((.+)\)\s*-->/g,
    CSS_IMPORT_RGE = /<!--\s*import:css\((.+)\)\s*-->/g,
    base_dir = [],
    prifix_reg = false;

  if (typeof options == 'object') {
    base_dir = options.base || base_dir;
  }
  if (base_dir instanceof Array && base_dir.length > 0) {
    prifix_reg = new RegExp('^(' + base_dir.join('|') + ')\\/');
  }

  if (typeof options.exclude == 'string') {
    options.exclude = [options.exclude];
  }
  if (typeof options.exclude != 'object' || !options.exclude instanceof Array) {
    options.exclude = [];
  }

  function replace_helper(src_pattern, dest, option, option_params, type) {
    var csses = [],
      rst_str = '';
    if (typeof src_pattern == 'string') {
      src_pattern = [src_pattern];
    }
    src_pattern = src_pattern.concat(options.exclude);
    if (typeof params == 'object') {
      if (!params[type]) {
        params[type] = [];
      }
      params[type].push({
        src: src_pattern,
        dest: dest
      });
      csses.push(dest);
    } else {
      csses = glob.sync(src_pattern, {
        nosort: true //不排序,采用深度遍历文件目录树
      });
    }

    for (var i = 0; i < csses.length; i++) {
      var tmp_css = csses[i];
      if (prifix_reg) {
        tmp_css = tmp_css.replace(prifix_reg, '');
      }
      rst_str += import_template[type].replace('__replacement__', tmp_css) + "\n\t";
    }

    rst_str = rst_str.slice(0, rst_str.length - 2);
    if (option == 'IE' && typeof option_params == 'string') {
      rst_str = '<!--' + option_params + '>\n\t\t' + rst_str.replace(/\n\t/g, "\n\t\t") + '\n\t<![endif]-->';
    }
    return rst_str;
  }

  function css_replace(src_pattern, dest, option, option_params) {
    return replace_helper(src_pattern, dest, option, option_params, 'css');
  }

  function js_replace(src_pattern, dest, option, option_params) {
    return replace_helper(src_pattern, dest, option, option_params, 'js');
  }


  function import_helper(content, reg, fn_name) {
    return content.replace(reg, function() {
      var rst = arguments[0];
      try {
        rst = eval(fn_name + '(' + arguments[1] + ')');
      } catch (e) {}
      return rst;
    });
  }

  /**
   * 替换掉content字符串中关于css的标记
   * @param  {string} content 文件内容的字符串
   * @return {string}         替换后的文件内容字符串
   */
  function import_css(content) {
    return import_helper(content, CSS_IMPORT_RGE, 'css_replace');
  }



  /**
   * 替换掉content字符串中关于js的标记
   * @param  {string} content 文件内容的字符串
   * @return {string}         替换后的文件内容字符串
   */
  function import_js(content) {
    return import_helper(content, JS_IMPORT_REG, 'js_replace');
  }

  function import_deal(file, enb, cb) {
    var content = file.contents.toString();
    content = import_js(import_css(content));
    if (typeof options.manifest == 'string') {
      content = content.replace('<html', '<html manifest="' + options.manifest + '"');
    }

    file.contents = new Buffer(content);
    this.push(file);
    cb();
  }

  return through.obj(import_deal);
};