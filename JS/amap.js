function Env(name, opts) {
  class Http {
    constructor(env) {
      this.env = env
    }

    send(opts, method = 'GET') {
      opts = typeof opts === 'string' ? { url: opts } : opts
      let sender = this.get
      if (method === 'POST') {
        sender = this.post
      }
      return new Promise((resolve, reject) => {
        sender.call(this, opts, (err, resp, body) => {
          if (err) reject(err)
          else resolve(resp)
        })
      })
    }

    get(opts) {
      return this.send.call(this.env, opts)
    }

    post(opts) {
      return this.send.call(this.env, opts, 'POST')
    }
  }

  return new (class {
    constructor(name, opts) {
      this.name = name
      this.http = new Http(this)
      this.data = null
      this.dataFile = 'box.dat'
      this.logs = []
      this.isMute = false
      this.isNeedRewrite = false
      this.logSeparator = '\n'
      this.encoding = 'utf-8'
      this.startTime = new Date().getTime()
      Object.assign(this, opts)
      this.log('', `🔔${this.name}, 开始!`)
    }

    isNode() {
      return 'undefined' !== typeof module && !!module.exports
    }

    isQuanX() {
      return 'undefined' !== typeof $task
    }

    isSurge() {
      return (
        'undefined' !== typeof $environment && $environment['surge-version']
      )
    }

    isLoon() {
      return 'undefined' !== typeof $loon
    }

    isShadowrocket() {
      return 'undefined' !== typeof $rocket
    }

    isStash() {
      return (
        'undefined' !== typeof $environment && $environment['stash-version']
      )
    }

    toObj(str, defaultValue = null) {
      try {
        return JSON.parse(str)
      } catch {
        return defaultValue
      }
    }

    toStr(obj, defaultValue = null) {
      try {
        return JSON.stringify(obj)
      } catch {
        return defaultValue
      }
    }

    getjson(key, defaultValue) {
      let json = defaultValue
      const val = this.getdata(key)
      if (val) {
        try {
          json = JSON.parse(this.getdata(key))
        } catch {}
      }
      return json
    }

    setjson(val, key) {
      try {
        return this.setdata(JSON.stringify(val), key)
      } catch {
        return false
      }
    }

    getScript(url) {
      return new Promise((resolve) => {
        this.get({ url }, (err, resp, body) => resolve(body))
      })
    }

    runScript(script, runOpts) {
      return new Promise((resolve) => {
        let httpapi = this.getdata('@chavy_boxjs_userCfgs.httpapi')
        httpapi = httpapi ? httpapi.replace(/\n/g, '').trim() : httpapi
        let httpapi_timeout = this.getdata(
          '@chavy_boxjs_userCfgs.httpapi_timeout'
        )
        httpapi_timeout = httpapi_timeout ? httpapi_timeout * 1 : 20
        httpapi_timeout =
          runOpts && runOpts.timeout ? runOpts.timeout : httpapi_timeout
        const [key, addr] = httpapi.split('@')
        const opts = {
          url: `http://${addr}/v1/scripting/evaluate`,
          body: {
            script_text: script,
            mock_type: 'cron',
            timeout: httpapi_timeout
          },
          headers: { 'X-Key': key, 'Accept': '*/*' },
          timeout: httpapi_timeout
        }
        this.post(opts, (err, resp, body) => resolve(body))
      }).catch((e) => this.logErr(e))
    }

    loaddata() {
      if (this.isNode()) {
        this.fs = this.fs ? this.fs : require('fs')
        this.path = this.path ? this.path : require('path')
        const curDirDataFilePath = this.path.resolve(this.dataFile)
        const rootDirDataFilePath = this.path.resolve(
          process.cwd(),
          this.dataFile
        )
        const isCurDirDataFile = this.fs.existsSync(curDirDataFilePath)
        const isRootDirDataFile =
          !isCurDirDataFile && this.fs.existsSync(rootDirDataFilePath)
        if (isCurDirDataFile || isRootDirDataFile) {
          const datPath = isCurDirDataFile
            ? curDirDataFilePath
            : rootDirDataFilePath
          try {
            return JSON.parse(this.fs.readFileSync(datPath))
          } catch (e) {
            return {}
          }
        } else return {}
      } else return {}
    }

    writedata() {
      if (this.isNode()) {
        this.fs = this.fs ? this.fs : require('fs')
        this.path = this.path ? this.path : require('path')
        const curDirDataFilePath = this.path.resolve(this.dataFile)
        const rootDirDataFilePath = this.path.resolve(
          process.cwd(),
          this.dataFile
        )
        const isCurDirDataFile = this.fs.existsSync(curDirDataFilePath)
        const isRootDirDataFile =
          !isCurDirDataFile && this.fs.existsSync(rootDirDataFilePath)
        const jsondata = JSON.stringify(this.data)
        if (isCurDirDataFile) {
          this.fs.writeFileSync(curDirDataFilePath, jsondata)
        } else if (isRootDirDataFile) {
          this.fs.writeFileSync(rootDirDataFilePath, jsondata)
        } else {
          this.fs.writeFileSync(curDirDataFilePath, jsondata)
        }
      }
    }

    lodash_get(source, path, defaultValue = undefined) {
      const paths = path.replace(/\[(\d+)\]/g, '.$1').split('.')
      let result = source
      for (const p of paths) {
        result = Object(result)[p]
        if (result === undefined) {
          return defaultValue
        }
      }
      return result
    }

    lodash_set(obj, path, value) {
      if (Object(obj) !== obj) return obj
      if (!Array.isArray(path)) path = path.toString().match(/[^.[\]]+/g) || []
      path
        .slice(0, -1)
        .reduce(
          (a, c, i) =>
            Object(a[c]) === a[c]
              ? a[c]
              : (a[c] = Math.abs(path[i + 1]) >> 0 === +path[i + 1] ? [] : {}),
          obj
        )[path[path.length - 1]] = value
      return obj
    }

    getdata(key) {
      let val = this.getval(key)
      // 如果以 @
      if (/^@/.test(key)) {
        const [, objkey, paths] = /^@(.*?)\.(.*?)$/.exec(key)
        const objval = objkey ? this.getval(objkey) : ''
        if (objval) {
          try {
            const objedval = JSON.parse(objval)
            val = objedval ? this.lodash_get(objedval, paths, '') : val
          } catch (e) {
            val = ''
          }
        }
      }
      return val
    }

    setdata(val, key) {
      let issuc = false
      if (/^@/.test(key)) {
        const [, objkey, paths] = /^@(.*?)\.(.*?)$/.exec(key)
        const objdat = this.getval(objkey)
        const objval = objkey
          ? objdat === 'null'
            ? null
            : objdat || '{}'
          : '{}'
        try {
          const objedval = JSON.parse(objval)
          this.lodash_set(objedval, paths, val)
          issuc = this.setval(JSON.stringify(objedval), objkey)
        } catch (e) {
          const objedval = {}
          this.lodash_set(objedval, paths, val)
          issuc = this.setval(JSON.stringify(objedval), objkey)
        }
      } else {
        issuc = this.setval(val, key)
      }
      return issuc
    }

    getval(key) {
      if (
        this.isSurge() ||
        this.isShadowrocket() ||
        this.isLoon() ||
        this.isStash()
      ) {
        return $persistentStore.read(key)
      } else if (this.isQuanX()) {
        return $prefs.valueForKey(key)
      } else if (this.isNode()) {
        this.data = this.loaddata()
        return this.data[key]
      } else {
        return (this.data && this.data[key]) || null
      }
    }

    setval(val, key) {
      if (
        this.isSurge() ||
        this.isShadowrocket() ||
        this.isLoon() ||
        this.isStash()
      ) {
        return $persistentStore.write(val, key)
      } else if (this.isQuanX()) {
        return $prefs.setValueForKey(val, key)
      } else if (this.isNode()) {
        this.data = this.loaddata()
        this.data[key] = val
        this.writedata()
        return true
      } else {
        return (this.data && this.data[key]) || null
      }
    }

    initGotEnv(opts) {
      this.got = this.got ? this.got : require('got')
      this.cktough = this.cktough ? this.cktough : require('tough-cookie')
      this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar()
      if (opts) {
        opts.headers = opts.headers ? opts.headers : {}
        if (undefined === opts.headers.Cookie && undefined === opts.cookieJar) {
          opts.cookieJar = this.ckjar
        }
      }
    }

    get(opts, callback = () => {}) {
      if (opts.headers) {
        delete opts.headers['Content-Type']
        delete opts.headers['Content-Length']
      }
      if (
        this.isSurge() ||
        this.isShadowrocket() ||
        this.isLoon() ||
        this.isStash()
      ) {
        if (this.isSurge() && this.isNeedRewrite) {
          opts.headers = opts.headers || {}
          Object.assign(opts.headers, { 'X-Surge-Skip-Scripting': false })
        }
        $httpClient.get(opts, (err, resp, body) => {
          if (!err && resp) {
            resp.body = body
            resp.statusCode = resp.status ? resp.status : resp.statusCode
            resp.status = resp.statusCode
          }
          callback(err, resp, body)
        })
      } else if (this.isQuanX()) {
        if (this.isNeedRewrite) {
          opts.opts = opts.opts || {}
          Object.assign(opts.opts, { hints: false })
        }
        $task.fetch(opts).then(
          (resp) => {
            const { statusCode: status, statusCode, headers, body } = resp
            callback(null, { status, statusCode, headers, body }, body)
          },
          (err) => callback((err && err.error) || 'UndefinedError')
        )
      } else if (this.isNode()) {
        let iconv = require('iconv-lite')
        this.initGotEnv(opts)
        this.got(opts)
          .on('redirect', (resp, nextOpts) => {
            try {
              if (resp.headers['set-cookie']) {
                const ck = resp.headers['set-cookie']
                  .map(this.cktough.Cookie.parse)
                  .toString()
                if (ck) {
                  this.ckjar.setCookieSync(ck, null)
                }
                nextOpts.cookieJar = this.ckjar
              }
            } catch (e) {
              this.logErr(e)
            }
            // this.ckjar.setCookieSync(resp.headers['set-cookie'].map(Cookie.parse).toString())
          })
          .then(
            (resp) => {
              const { statusCode: status, statusCode, headers, rawBody } = resp
              const body = iconv.decode(rawBody, this.encoding)
              callback(
                null,
                { status, statusCode, headers, rawBody, body },
                body
              )
            },
            (err) => {
              const { message: error, response: resp } = err
              callback(
                error,
                resp,
                resp && iconv.decode(resp.rawBody, this.encoding)
              )
            }
          )
      }
    }

    post(opts, callback = () => {}) {
      const method = opts.method ? opts.method.toLocaleLowerCase() : 'post'
      // 如果指定了请求体, 但没指定`Content-Type`, 则自动生成
      if (opts.body && opts.headers && !opts.headers['Content-Type']) {
        opts.headers['Content-Type'] = 'application/x-www-form-urlencoded'
      }
      if (opts.headers) delete opts.headers['Content-Length']
      if (
        this.isSurge() ||
        this.isShadowrocket() ||
        this.isLoon() ||
        this.isStash()
      ) {
        if (this.isSurge() && this.isNeedRewrite) {
          opts.headers = opts.headers || {}
          Object.assign(opts.headers, { 'X-Surge-Skip-Scripting': false })
        }
        $httpClient[method](opts, (err, resp, body) => {
          if (!err && resp) {
            resp.body = body
            resp.statusCode = resp.status ? resp.status : resp.statusCode
            resp.status = resp.statusCode
          }
          callback(err, resp, body)
        })
      } else if (this.isQuanX()) {
        opts.method = method
        if (this.isNeedRewrite) {
          opts.opts = opts.opts || {}
          Object.assign(opts.opts, { hints: false })
        }
        $task.fetch(opts).then(
          (resp) => {
            const { statusCode: status, statusCode, headers, body } = resp
            callback(null, { status, statusCode, headers, body }, body)
          },
          (err) => callback((err && err.error) || 'UndefinedError')
        )
      } else if (this.isNode()) {
        let iconv = require('iconv-lite')
        this.initGotEnv(opts)
        const { url, ..._opts } = opts
        this.got[method](url, _opts).then(
          (resp) => {
            const { statusCode: status, statusCode, headers, rawBody } = resp
            const body = iconv.decode(rawBody, this.encoding)
            callback(null, { status, statusCode, headers, rawBody, body }, body)
          },
          (err) => {
            const { message: error, response: resp } = err
            callback(
              error,
              resp,
              resp && iconv.decode(resp.rawBody, this.encoding)
            )
          }
        )
      }
    }
    /**
     *
     * 示例:$.time('yyyy-MM-dd qq HH:mm:ss.S')
     *    :$.time('yyyyMMddHHmmssS')
     *    y:年 M:月 d:日 q:季 H:时 m:分 s:秒 S:毫秒
     *    其中y可选0-4位占位符、S可选0-1位占位符，其余可选0-2位占位符
     * @param {string} fmt 格式化参数
     * @param {number} 可选: 根据指定时间戳返回格式化日期
     *
     */
    time(fmt, ts = null) {
      const date = ts ? new Date(ts) : new Date()
      let o = {
        'M+': date.getMonth() + 1,
        'd+': date.getDate(),
        'H+': date.getHours(),
        'm+': date.getMinutes(),
        's+': date.getSeconds(),
        'q+': Math.floor((date.getMonth() + 3) / 3),
        'S': date.getMilliseconds()
      }
      if (/(y+)/.test(fmt))
        fmt = fmt.replace(
          RegExp.$1,
          (date.getFullYear() + '').substr(4 - RegExp.$1.length)
        )
      for (let k in o)
        if (new RegExp('(' + k + ')').test(fmt))
          fmt = fmt.replace(
            RegExp.$1,
            RegExp.$1.length == 1
              ? o[k]
              : ('00' + o[k]).substr(('' + o[k]).length)
          )
      return fmt
    }

    /**
     *
     * @param {Object} options
     * @returns {String} 将 Object 对象 转换成 queryStr: key=val&name=senku
     */
    queryStr(options) {
      let queryString = ''

      for (const key in options) {
        let value = options[key]
        if (value != null && value !== '') {
          if (typeof value === 'object') {
            value = JSON.stringify(value)
          }
          queryString += `${key}=${value}&`
        }
      }
      queryString = queryString.substring(0, queryString.length - 1)

      return queryString
    }

    /**
     * 系统通知
     *
     * > 通知参数: 同时支持 QuanX 和 Loon 两种格式, EnvJs根据运行环境自动转换, Surge 环境不支持多媒体通知
     *
     * 示例:
     * $.msg(title, subt, desc, 'twitter://')
     * $.msg(title, subt, desc, { 'open-url': 'twitter://', 'media-url': 'https://github.githubassets.com/images/modules/open_graph/github-mark.png' })
     * $.msg(title, subt, desc, { 'open-url': 'https://bing.com', 'media-url': 'https://github.githubassets.com/images/modules/open_graph/github-mark.png' })
     *
     * @param {*} title 标题
     * @param {*} subt 副标题
     * @param {*} desc 通知详情
     * @param {*} opts 通知参数
     *
     */
    msg(title = name, subt = '', desc = '', opts) {
      const toEnvOpts = (rawopts) => {
        if (!rawopts) return rawopts
        if (typeof rawopts === 'string') {
          if (this.isLoon() || this.isShadowrocket()) return rawopts
          else if (this.isQuanX()) return { 'open-url': rawopts }
          else if (this.isSurge() || this.isStash()) return { url: rawopts }
          else return undefined
        } else if (typeof rawopts === 'object') {
          if (this.isLoon()) {
            let openUrl = rawopts.openUrl || rawopts.url || rawopts['open-url']
            let mediaUrl = rawopts.mediaUrl || rawopts['media-url']
            return { openUrl, mediaUrl }
          } else if (this.isQuanX()) {
            let openUrl = rawopts['open-url'] || rawopts.url || rawopts.openUrl
            let mediaUrl = rawopts['media-url'] || rawopts.mediaUrl
            let updatePasteboard =
              rawopts['update-pasteboard'] || rawopts.updatePasteboard
            return {
              'open-url': openUrl,
              'media-url': mediaUrl,
              'update-pasteboard': updatePasteboard
            }
          } else if (
            this.isSurge() ||
            this.isShadowrocket() ||
            this.isStash()
          ) {
            let openUrl = rawopts.url || rawopts.openUrl || rawopts['open-url']
            return { url: openUrl }
          }
        } else {
          return undefined
        }
      }
      if (!this.isMute) {
        if (
          this.isSurge() ||
          this.isShadowrocket() ||
          this.isLoon() ||
          this.isStash()
        ) {
          $notification.post(title, subt, desc, toEnvOpts(opts))
        } else if (this.isQuanX()) {
          $notify(title, subt, desc, toEnvOpts(opts))
        }
      }
      if (!this.isMuteLog) {
        let logs = ['', '==============📣系统通知📣==============']
        logs.push(title)
        subt ? logs.push(subt) : ''
        desc ? logs.push(desc) : ''
        console.log(logs.join('\n'))
        this.logs = this.logs.concat(logs)
      }
    }

    log(...logs) {
      if (logs.length > 0) {
        this.logs = [...this.logs, ...logs]
      }
      console.log(logs.join(this.logSeparator))
    }

    logErr(err, msg) {
      const isPrintSack =
        !this.isSurge() &&
        !this.isShadowrocket() &&
        !this.isQuanX() &&
        !this.isLoon() &&
        !this.isStash()
      if (!isPrintSack) {
        this.log('', `❗️${this.name}, 错误!`, err)
      } else {
        this.log('', `❗️${this.name}, 错误!`, err.stack)
      }
    }

    wait(time) {
      return new Promise((resolve) => setTimeout(resolve, time))
    }

    done(val = {}) {
      const endTime = new Date().getTime()
      const costTime = (endTime - this.startTime) / 1000
      this.log('', `🔔${this.name}, 结束! 🕛 ${costTime} 秒`)
      this.log()
      if (
        this.isSurge() ||
        this.isShadowrocket() ||
        this.isQuanX() ||
        this.isLoon() ||
        this.isStash()
      ) {
        $done(val)
      } else if (this.isNode()) {
        process.exit(1)
      }
    }
  })(name, opts)
}

// 2023-03-28 18:15

const url = $request.url;
if (!$response.body) $done({});
let obj = JSON.parse($response.body);

if (url.includes("/faas/amap-navigation/main-page")) {
  // 首页底部卡片
  if (obj.data.cardList) {
    obj.data.cardList = obj.data.cardList.filter(
      (i) =>
        i.dataKey === "ContinueNavigationCard" || // 继续导航
        i.dataKey === "FrequentLocation" || // 常去地点
        i.dataKey === "LoginCard" // 登陆卡片
    );
  }
  if (obj.data.mapBizList) {
    obj.data.mapBizList = obj.data.mapBizList.filter(
      (i) => i.dataKey === "FindCarVirtualCard" // 显示关联车辆位置
    );
  }
} else if (url.includes("/faas/amap-navigation/usr-profile-fc/")) {
  const item = [
    "bulletData",
    "cardList",
    "dataList",
    "homePageData",
    "privateData",
    "shareData",
    "upgradeDialogData"
  ];
  for (let i of item) {
    if (obj.data?.[i]) {
      obj.data[i] = [];
    }
  }
} else if (url.includes("/mapapi/poi/infolite")) {
  // 搜索结果 列表详情
  if (obj.data.district) {
    let poi = obj.data.district.poi_list[0];
    // 订票横幅 订票用高德 出行享低价
    if (poi?.transportation) {
      delete poi.transportation;
    }
    // 周边推荐 列表项 景点 酒店 美食
    if (poi?.feed_rec_tab) {
      delete poi.feed_rec_tab;
    }
  } else if (obj.data.list_data) {
    let list = obj.data.list_data.content[0];
    if (list?.bottom?.taxi_button) {
      list.bottom.taxi_button = 0;
    }
    // 底栏 酒店
    if (list?.map_bottom_bar?.hotel) {
      delete list.map_bottom_bar.hotel;
    }
    if (list?.poi?.item_info?.tips_bottombar_button?.hotel) {
      delete list.poi.item_info.tips_bottombar_button.hotel;
    }
    if (list?.tips_operation_info) {
      delete list.tips_operation_info;
    }
    if (list?.bottom?.bottombar_button?.hotel) {
      delete list.bottom.bottombar_button.hotel;
    }
    // 底栏 打车
    if (list?.bottom?.bottombar_button?.takeCar) {
      delete list.bottom.bottombar_button.takeCar;
    }
    // 预览信息中的优惠推广
    if (list?.promotion_wrap_card) {
      delete list.promotion_wrap_card;
    }
    // 预览信息中的推广
    if (list?.hookInfo) {
      delete list.hookInfo;
    }
  }
} else if (url.includes("/promotion-web/resource")) {
  // 打车页面
  let item = [
    "alpha", // 出行优惠套餐
    "banner",
    "bravo", // 第三方推广 喜马拉雅月卡
    "bubble",
    "charlie", // 横版推广 单单立减 领专属优惠 体验问卷
    "icon",
    "popup",
    "push", // 顶部通知 发单立享优惠
    "tips"
  ];
  if (obj.data) {
    item.forEach((i) => {
      delete obj.data[i];
    });
  }
} else if (url.includes("/sharedtrip/taxi/order_detail_car_tips")) {
  if (obj.data?.carTips?.data?.popupInfo) {
    delete obj.data.carTips.data.popupInfo;
  }
} else if (url.includes("/shield/dsp/profile/index/nodefaasv3")) {
  // 我的页面
  if (obj.data.cardList) {
    obj.data.cardList = obj.data.cardList.filter(
      (i) => i.dataKey === "MyOrderCard"
    );
  }
  if (obj.data.tipData) {
    delete obj.data.tipData;
  }
  if (obj.data.footPrintV2) {
    delete obj.data.footPrintV2;
  }
  // 成就勋章 lv1见习达人
  if (obj.data.memberInfo) {
    delete obj.data.memberInfo;
  }
} else if (url.includes("/shield/frogserver/aocs")) {
  // 整体图层
  const item = [
    "collect",
    "footprint", // 足迹
    "gd_notch_logo",
    "his_input_tip",
    "home_business_position_config", // 首页右上角动图
    "hotel_activity",
    "hotel_loop",
    "hotel_tipsicon",
    "icon_show",
    "isNewSearchMapCard", // 可能是足迹
    "operation_layer", // 首页右上角图层
    "photo_with_location",
    "profileHeaderPic",
    "profiletTopBtn",
    "splashscreen",
    "testflight_adiu",
    "vip",
    "_user_profile_"
  ];
  for (let i of item) {
    if (obj.data?.[i]) {
      obj.data[i] = { status: 1, version: "", value: "" };
    }
  }
} else if (url.includes("/shield/search/nearbyrec_smart")) {
  // 附近页面
  if (obj.data.modules) {
    obj.data.modules = obj.data.modules.filter(
      (i) => i === "head" || i === "search_hot_words" || i === "feed_rec"
    );
  }
} else if (url.includes("/shield/search/poi/detail")) {
  // 搜索结果 模块详情
  const item = [
    // "anchor",
    "adv_compliance_info", // 服务提供方
    "adv_gift",
    // "base_info",
    "bigListBizRec", // 周边景点推荐 三张景点大图
    // "brand_introduction",
    "brand_shop_bar",
    // "brand_story",
    "checkIn",
    "check_in", // 足迹打卡
    "city_discount", // 专业老师在线答疑
    "claim", // 立即认领 管理店铺
    "co_branded_card",
    "collector_guide", // 游玩的图文指南
    "common_coupon_bar", // 领券条幅 新客专享 省钱卡
    // "consultancy",
    "contributor", // 地点贡献
    // "coupon_allowance",
    // "coupon_entrance",
    "cpt_service_shop", //买卖二手房
    // "craftsman_entry",
    // "crowd_index", // 人流量情况
    // "detailFeedCommodity",
    // "detail_bottom_shop_service",
    "divergentRecommendModule", // 你可能还喜欢
    // "evaluate", // 高德出行评分
    // "events",
    "everyOneToSee", // 大家还在看
    "feedback", // 问题反馈
    "first_surround_estate_tab", // 周边小区
    // "footer_logo",
    // "foreclosurehouse",
    // "gallery_info", // 现场照片
    // "ggc_entry",
    // "hkfMiniPortal", // 订票页面 飞机 火车 汽车
    "horizontalGoodsShelf",
    "hot_new_house_estate",
    "hot_shop",
    "hotelCoupon",
    // "hotelRooms", // 酒店所有房间
    // "hourHotelRooms", // 钟点房
    "houseList",
    "houseOfficeBrandIntroduction",
    "houseOfficeInfo",
    "houseOfficeNotice",
    "houseOfficeService",
    "house_apart_info",
    "house_buying_agent",
    "house_coupon",
    "house_cp_clues",
    "house_cpt_coupon",
    "house_cpt_grab",
    "house_price",
    "house_rent_sale_agency",
    // "human_traffic", // 人流量情况 有统计图
    "image_banner",
    "legal_document", // 房源法律信息
    "listBizRec_1",
    "listBizRec_2", // 周边餐饮
    "membership", // 高德菲住卡 会员项目
    "movie_info", // 优惠购票 景点宣传片
    "multi_page_anchor", // 二级导航菜单 门票 评论 推荐
    "nearbyRecommendModule", // 周边推荐
    "nearby_house",
    "nearby_new_house_estate",
    "nearby_office_estate",
    "nearby_old_sell_estate",
    "nearby_play_rec", // 附近玩乐项目
    "newGuest", // 新客专享
    "newRelatedRecommends", // 探索周边
    "new_operation_banner", // 精选活动 高德的推广
    "newsellhouse",
    // "normal_nav_bar", // 右上角图标 客服 反馈
    // "notification",
    "officerenthouse",
    "officesellhouse",
    "official_account", // 其他平台官方账号
    "oldsellhouse",
    // "opentime", // 营业时间
    "operation_banner", // 横版图片推广
    "operator_card",
    // "packageShelf",
    "parentBizRec",
    "poster_banner",
    // "poi_intercept",
    "portal_entrance", // 高德旅游版块 引流到旅游频道
    // "question_answer_card", // 问问 地点附近的热门问题
    "relatedRecommends", // 附近同类型酒店
    // "realtorRealStep",
    "renthouse",
    "rentsaleagencyv2",
    "rentsaleagencyv3",
    "rentsalehouse",
    "residentialOwners", // 小区业主
    "reviews", // 用户评价
    // "roomSelect", // 选择订房日期 悬浮菜单
    "sameIndustryRecommendModule",
    "sameIndustry2RecommendModule",
    // "same_price_new_estate",
    "scenic_coupon", // 优惠券过期提示
    "scenic_filter", // 购票悬浮菜单 可定明日 随时退
    // "scenic_guide",
    // "scenic_helper", // 景区助手 开放时间 旺季 淡季
    // "scenic_knowledge",
    "scenic_lifeservices", // 吃住购娱 餐厅 购物
    "scenic_mustplay", // 必游景点 四张景点大图
    // "scenic_parking",
    "scenic_play_guide", // 景区攻略 游玩攻略 交通攻略
    "scenic_recommend", // 景点建议
    // "scenic_route",
    // "scenic_route_intelligent", // 推荐游玩线路
    // "scenic_service",
    // "scenic_ski", // 滑雪攻略 雪道数量 设施及服务
    // "scenic_story",
    // "scenic_ticket", // 购票
    // "scenic_ticket_activity", // 购票活动
    "scenic_voice", // 语音讲解 付费的项目
    "second_surround_estate_tab", // 周边房产
    "service_shop", // 中介门店
    // "shop_news",
    "smallListBizRec", // 周边热门酒店
    "smallOrListBizRec",
    "surround_facility",
    "surround_facility_new",
    "surround_house_tab",
    "surround_oldsellhouse",
    "surround_renthouse",
    "surround_rentoffice",
    "surround_selloffice",
    // "traffic", // 交通出行 地铁站 公交站 停车场
    "uploadBar",
    "upload_bar", // 上传照片
    "verification" // 商家已入驻
    // "video",
  ];
  if (obj.data.modules) {
    item.forEach((i) => {
      delete obj.data.modules[i];
    });
  }
} else if (url.includes("/shield/search_poi/search/sp")) {
  if (obj.data.list_data) {
    let list = obj.data.list_data.content[0];
    // 详情页 底部 房产推广
    if (list?.hookInfo) {
      let hookData = list.hookInfo.data;
      if (hookData?.header) {
        delete hookData.header;
      }
      if (hookData?.house_info) {
        delete hookData.house_info;
      }
    }
    // 详情页 底部 订酒店
    if (list?.map_bottom_bar?.hotel) {
      delete list.map_bottom_bar.hotel;
    }
    if (list?.poi?.item_info?.tips_bottombar_button?.hotel) {
      delete list.poi.item_info.tips_bottombar_button.hotel;
    }
    if (list?.tips_operation_info) {
      delete list.tips_operation_info;
    }
    if (list?.bottom?.bottombar_button?.hotel) {
      delete list.bottom.bottombar_button.hotel;
    }
  }
} else if (url.includes("/shield/search_poi/tips_operation_location")) {
  // 搜索页面 底部结果上方窄横幅
  if (obj.data.coupon) {
    delete obj.data.coupon;
  }
  const bar = [
    "belt",
    "common_float_bar",
    "common_image_banner",
    "coupon_discount_float_bar",
    "coupon_float_bar",
    "discount_coupon",
    "image_cover_bar",
    "mood_coupon_banner",
    "operation_brand",
    "promotion_wrap_card",
    "tips_top_banner"
  ];
  if (obj.data.modules) {
    bar.forEach((i) => {
      delete obj.data.modules[i];
    });
  }
} else if (url.includes("/valueadded/alimama/splash_screen")) {
  // 开屏广告
  if (obj.data.ad) {
    for (let item of obj.data.ad) {
      item.set.setting.display_time = 0;
      item.creative[0].start_time = 2208960000; // Unix 时间戳 2040-01-01 00:00:00
      item.creative[0].end_time = 2209046399; // Unix 时间戳 2040-01-01 23:59:59
    }
  }
}

$done({ body: JSON.stringify(obj) });
