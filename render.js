const jade =
  require("jade")

const fs =
  require("fs")

const sass =
  require("node-sass")

const path =
  require("path")

const dateformat = 
  require('dateformat')

const mkdirp =
  require("mkdirp")

const markdown = 
  require("node-markdown").Markdown

const Tables = 
  require("./tables")

const Pipe =
  require("./util/pipe")

const Template =
  { Topic: topic => [topic, jade.renderFile("./templates/topic.jade", {topic, markdown})]
  , Topics: topics => [topics, jade.renderFile("./templates/topic_index.jade", {topics})]
  }

const noop = () => {}

const not = 
  (t) => !t

const where = 
  (list, predicate) => list.filter(predicate)

const group_by = 
  (list, attr)=> list
    .reduce((acc, entry)=> not(entry[attr]) ? acc : Object
      .assign(acc, {[entry[attr]]: (acc[entry[attr]] || [])
        .concat(entry) }), {})

const pluck =
  (obj = {}, ...attrs)=> attrs.reduce((acc, attr)=> Object.assign(acc, {[attr]: obj[attr]}) , {})

const map =
  (list, fn, ...rest)=> list.map(v => fn(v, ...rest))

const last =
  (list)=> list[list.length-1]

const sort =
  (list, predicate)=> list.sort(predicate)

const find =
  (list, member)=> list.find(m => m === member)

const take =
  (list, n, offset = 0)=> list.slice(offset, n)

const lookup_topic =
  (topic_id)=> Tables.topics[`topic:${topic_id}`]

const lookup_user =
  (uid)=> Pipe.of(Tables.users[`user:${uid}`])
              .fmap(pluck, "username", "userslug")
              .fmap(Pipe.lift)

const without =
  (list, ...keys)=> Object.entries(list)
    .filter(([k, _])=> not(keys.includes(k)))
    .reduce((acc, [k, v])=> Object.assign(acc, {[k]: v}), {})

const topic_with_posts =
  ([topic_id, posts])=> [topic_id, 
    Object.assign({posts}, lookup_topic(topic_id))]

const post_with_user =
  (post)=> Object.assign(post, {user: lookup_user(post.uid)})

const format_timestamp =
  (post)=> Object.assign(post, {pretty_ts: dateformat(new Date(parseInt(post.timestamp)), "dddd, mmmm dS, yyyy, h:MM:ss TT") })

const topic_with_user =
  ([topic_id, acc])=> [topic_id, 
    Object.assign(acc
      , lookup_user(acc.uid)
      , {posts: acc.posts
          .map(post_with_user)
          .sort( (a,b)=> parseInt(a.timestamp) - parseInt(b.timestamp) )
          .map(format_timestamp)
      })
  ]

const not_deleted =
  (post) => not(post.deleted == "1")

const without_images = 
  ([_, post])=> [_, 
    Object.assign(post, {content: post.content.replace('s/\!\[[^]]*\]([^)]*)//g', "")})]

const write =
  ([topic, html], dir)=> {
    const local_path = path.join(process.cwd(), dir, "topics", topic.slug)
    const file_path = path.join(local_path, "index.html")
    console.log(`
      Topic[${topic.slug}]
      Posts.length[${topic.posts.length}]
      http://localhost:8000/topics/${topic.slug}`)
    mkdirp(local_path, (err)=> {
      if (err) throw err
      fs.writeFileSync(file_path, html)
    })
  }

const topics = _ => Pipe.of(Tables.posts)
  .fmap(Object.values)
  .fmap(where, not_deleted)
  .fmap(group_by, "tid")
  .fmap(Object.entries)
  .fmap(map, topic_with_posts)
  .fmap(map, topic_with_user)
  .fmap(map, last)
  .fmap(sort, (a,b)=> a.posts.length - b.posts.length)
  //.fmap(take, 1)
  .fmap(Pipe.lift)

const write_all_topics = topics => Pipe.of(topics) 
  .fmap(map, Template.Topic)
  .fmap(map, write, "dist")

const write_index_page = topics => Pipe.of(topics)
  .fmap(map, without, "posts")
  .fmap(map, format_timestamp)
  .fmap(sort, (a,b)=> parseInt(b.timestamp) - parseInt(a.timestamp))
  .fmap(Template.Topics)
  .fmap( ([_, html]) => {
    const local_path = path.join(process.cwd(), "dist", "topics")
    const file_path = path.join(local_path, "index.html")
    mkdirp(local_path, (err)=> {
      if (err) throw err
      fs.writeFileSync(file_path, html)
      console.log(`wrote Topic Index to ${file_path}`)
    })
  })

const write_css = _ => {
  const {css} = sass.renderSync({file: "sass/app.sass"})
  const local_path = path.join(process.cwd(), "dist", "style")
  const css_path = path.join(local_path, "app.css")
  mkdirp(local_path, (err) => {
    if (err) throw err
    console.log(`compiled SASS to ${css_path}`)
    fs.writeFileSync(css_path, css)
  }) 
}

Pipe.of()
  .fmap((find(process.argv, "--topics") || find(process.argv, "--index")) ? topics : noop)
  .tap(find(process.argv, "--topics") ? write_all_topics : noop)
  .tap(find(process.argv, "--index") ? write_index_page : noop)
  .tap(find(process.argv, "--css") ? write_css : noop)

  