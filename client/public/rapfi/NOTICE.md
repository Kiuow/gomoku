# Rapfi 来源与许可

本目录中的 `rapfi-single-simd128.js`、`rapfi-single-simd128.wasm` 和 `rapfi-single-simd128.data` 是 Rapfi 的浏览器版引擎产物。Rapfi 上游项目为 [dhbloo/rapfi](https://github.com/dhbloo/rapfi)，其 [README](https://github.com/dhbloo/rapfi/blob/master/Readme.md#terms-of-use) 声明按 GNU GPLv3 发布。许可证正文见本目录的 [COPYING.txt](COPYING.txt)。

`worker.js` 及上一级目录的 `rapfi-bridge.js` 是本项目用于加载和调用引擎的桥接代码。当前仓库尚未记录这组三个引擎产物的精确上游提交及完整构建步骤；公开再分发前，应核对对应源码和模型文件的来源，并满足 GPLv3 的源码提供要求。不能仅凭本说明将应用其他源码视为按 GPLv3 授权。
