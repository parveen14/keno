import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Button, Space, Divider, Typography } from 'antd';
import { BoldOutlined, ItalicOutlined, UnorderedListOutlined, OrderedListOutlined, LinkOutlined, PictureOutlined } from '@ant-design/icons';
import api from '../lib/api.js';

// Controlled rich-text field: value/onChange are HTML strings, so it drops
// straight into an antd <Form.Item> like any other input.
export default function RichTextEditor({ value, onChange, placeholder }) {
  const fileInputRef = React.useRef(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false }),
      Image.configure({ HTMLAttributes: { style: 'max-width: 100%;' } }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
    editorProps: {
      attributes: { class: 'keno-rte-content' },
    },
  });

  React.useEffect(() => {
    if (editor && value !== undefined && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  const setLink = () => {
    const url = window.prompt('Link URL');
    if (url) editor.chain().focus().setLink({ href: url }).run();
  };

  const insertImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post('/uploads', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    editor.chain().focus().setImage({ src: data.url }).run();
  };

  return (
    <div style={{ border: '1px solid #d9d9d9', borderRadius: 8 }}>
      <Space size={4} style={{ padding: '6px 8px', borderBottom: '1px solid #f0f0f0' }}>
        <Button size="small" type={editor.isActive('heading', { level: 2 }) ? 'primary' : 'text'} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Button>
        <Button size="small" type={editor.isActive('heading', { level: 3 }) ? 'primary' : 'text'} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</Button>
        <Divider type="vertical" />
        <Button size="small" type={editor.isActive('bold') ? 'primary' : 'text'} icon={<BoldOutlined />} onClick={() => editor.chain().focus().toggleBold().run()} />
        <Button size="small" type={editor.isActive('italic') ? 'primary' : 'text'} icon={<ItalicOutlined />} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <Divider type="vertical" />
        <Button size="small" type={editor.isActive('bulletList') ? 'primary' : 'text'} icon={<UnorderedListOutlined />} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <Button size="small" type={editor.isActive('orderedList') ? 'primary' : 'text'} icon={<OrderedListOutlined />} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <Divider type="vertical" />
        <Button size="small" type={editor.isActive('link') ? 'primary' : 'text'} icon={<LinkOutlined />} onClick={setLink} />
        <Button size="small" type="text" icon={<PictureOutlined />} onClick={() => fileInputRef.current?.click()} />
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={insertImage} />
      </Space>
      {editor.isEmpty && placeholder && (
        <Typography.Text type="secondary" style={{ display: 'block', padding: '8px 12px 0' }}>{placeholder}</Typography.Text>
      )}
      <EditorContent editor={editor} style={{ padding: '8px 12px', minHeight: 120 }} />
    </div>
  );
}
