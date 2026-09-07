# CPchart - 人物关系连线图
## 当前版本：0.10.2 web✅ release❌ xhs❌
> 为小红书小工具容器设计的 CP 连线关系图工具。当前为手机端移植版，还没做响应式布局。
> 生成一个按轨道分布的CP连线关系图，支持多角色分圈排布、关系类型表管理、多层连线叠加，所有数据本地保存，离线可用。

---

## 🚀 快速开始

- **网页版**：[点击这里打开GitHub页面](https://minedopa.github.io/CPchart/)
- **小红书小工具**：[点击这里为开发者点赞助力比赛](https://www.xiaohongshu.com/explore/6a9eb288000000002b01255d?xsec_token=AB1_71HSNk4mspVDUI955uDEqL_ILiSw3NKpz8h323Mdw=&xsec_source=pc_user)
- **本地版**：下载发行版zip包，解压缩后点击index.html
  
---

## ✨ 功能特点

- **圆环布局**：单圆心 + 多圈分布，角色自动均分排布，拖拽换圈/半径调节
- **多线叠加**：同一对角色可画多条独立连线，底层粗线 + 顶层细线 + 箭头自由组合，互不覆盖
- **样式表**：喜好度层 / 关系类型层 / 箭头方向，增删改实时刷新全图
- **人物管理**：名单批量导入、头像设置、喜好度标记、显示模式一键切换
- **手势操作**：双指缩放、单指平移，完美适配移动端触屏
- **数据快照**：完整导入导出（文本交换），localStorage 自动保存草稿
- **成品输出**：隐藏 UI 生成预览图，调用容器 API 保存到相册


## 🛠️ 技术栈

- 原生 HTML / CSS / JavaScript（零框架依赖）
- Canvas 2D + SVG 混合渲染
- localStorage 本地持久化
- 适配小红书小工具容器约束（无内联脚本、无网络请求、无剪贴板 API）

---

## 📄 许可证

本项目采用 **MIT 许可证**，详见 [LICENSE](LICENSE) 文件。

> 📢 如果您基于本项目做了商业产品，希望能告诉我一声，让我知道我的作品去了哪里，如果能给我个工作就更好了。


---

## 🙋 反馈与支持

- 提交 Issue：[GitHub Issues](https://github.com/MineDopa/CPchart/issues)
- 使用中有任何问题欢迎留言反馈
- **Happy Charting! 🎨**
