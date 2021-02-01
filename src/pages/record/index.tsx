import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useHistory } from 'react-router';
import { useInfiniteQuery, useQueryClient, useMutation } from 'react-query';
import {
  List,
  InfiniteLoader,
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  ListRowProps,
  InfiniteLoaderChildProps,
} from 'react-virtualized';

import {
  Empty,
  Input,
  Layout,
  Button,
  Menu,
  Space,
  Modal,
  Form,
  Radio,
} from 'antd';

const { Header, Content, Footer } = Layout;

import styled from 'styled-components';
import { PlusOutlined } from '@ant-design/icons';

import { SelectInfo } from 'rc-menu/lib/interface';

import { RESTful } from '@/http';
import { mainHost } from '@/http/host';

import RecordItem from './components/RecordItem';

import { Record } from '@/models/record';

const RecordHeader = styled(Header)`
  background: white;
  box-shadow: 0px 1px 20px 5px rgb(0 0 0 / 5%);
  display: flex;
  align-items: center;
  width: 100vw;
  overflow-x: auto;
`;

const RecordFooter = styled(Footer)`
  background: white;
  display: flex;
  justify-content: space-between;
  width: 100vw;
  overflow-x: auto;
  padding: 12px 8px;
`;

const CenterEmpty = styled(Empty)`
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

type inputType = '' | '新建' | '编辑';

const limit = 10;

const cache = new CellMeasurerCache();

export default () => {
  const [sortForm] = Form.useForm();
  const [inputForm] = Form.useForm();
  const history = useHistory();
  const _location = history.location;
  const _search = _location.search;
  const params = new URLSearchParams(_search);
  const selectedKeys = [params.get('type') || 'all'];

  const [sortVisable, setSortVisable] = useState(false);
  const [inputVisable, setInputVisable] = useState(false);
  const [inputType, setInputType] = useState<inputType>('新建');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const contentRef = useRef<HTMLDivElement>(null);
  const [contentRect, setContentRec] = useState<DOMRect>();

  // 编辑modal使用
  const [curRecrod, setCurRecord] = useState<Record>();

  const infiniteRef = useRef<any>(null);

  useLayoutEffect(() => {
    const current = contentRef.current;
    const obj = current?.getBoundingClientRect();
    obj && setContentRec(obj);
  }, [contentRef]);

  useEffect(() => {
    const params = new URLSearchParams(_search);
    sortForm.setFieldsValue(Object.fromEntries(params.entries()));
  }, [_search]);

  const queryClient = useQueryClient();

  const { data, fetchNextPage, hasNextPage, isFetching } = useInfiniteQuery(
    ['records-list', _search],
    ({ pageParam = 0 }) => {
      const params: { [key: string]: string | number } = Object.fromEntries(
        new URLSearchParams(_search),
      );

      return RESTful.get(`${mainHost()}/record/list`, {
        silence: 'success',
        params: {
          ...params,
          skip: pageParam * limit,
          limit,
        },
      });
    },
    {
      getNextPageParam: (lastPage, pages) => {
        return lastPage?.data?.length === limit ? pages?.length : undefined;
      },
    },
  );

  const creator = useMutation(
    (data) => RESTful.post(`${mainHost()}/record/create`, { data }),
    {
      onSuccess() {
        queryClient.invalidateQueries('records-list');
        inputForm.resetFields();
        setInputVisable(false);
      },
    },
  );

  const updater = useMutation(
    (data?: { [key: string]: any }) =>
      RESTful.put(`${mainHost()}/record/update`, {
        data: { id: curRecrod?._id, ...data },
      }),
    {
      onSuccess() {
        queryClient.invalidateQueries('records-list');
        inputForm.resetFields();
        setInputVisable(false);
      },
    },
  );

  const deleter = useMutation(
    (data?: string) => RESTful.delete(`${mainHost()}/record/remove/${data}`),
    {
      onSuccess() {
        queryClient.invalidateQueries('records-list');
      },
    },
  );

  const datas = data?.pages,
    pages = datas?.reduce((acc, cur) => acc.concat(cur?.data), []),
    total = datas?.[datas?.length - 1]?.total || 0;

  function onMenuSelect({ key }: SelectInfo) {
    if (key !== 'all') {
      params.set('type', `${key}`);
    } else {
      params.delete('type');
    }
    history.push({
      pathname: _location.pathname,
      search: params.toString(),
    });
  }

  function showSortModal() {
    setSortVisable(true);
  }

  function hideSortModal() {
    setSortVisable(false);
  }

  function onSortSubmit() {
    sortForm.validateFields().then(({ sort, orderby }) => {
      params.set('sort', sort);
      params.set('orderby', orderby);
      history.push({
        pathname: _location.pathname,
        search: params.toString(),
      });
      setSortVisable(false);
    });
  }

  function onSortCancel() {
    params.delete('sort');
    params.delete('orderby');
    history.push({
      pathname: _location.pathname,
      search: params.toString(),
    });
    sortForm.resetFields();
    setSortVisable(false);
  }

  function showInpurModal(e: React.MouseEvent<HTMLElement, MouseEvent>) {
    setInputType(e.currentTarget.dataset.inputType as inputType);
    setInputVisable(true);
  }

  function hideInputModal() {
    setInputVisable(false);
  }

  function onInputSubmit() {
    inputForm.validateFields().then((values) => {
      switch (inputType) {
        case '新建':
          creator.mutate(values);
          break;
        case '编辑':
          updater.mutate(values);
          break;
        default:
          console.error('invalidate type:', inputType);
      }
      infiniteRef.current?.resetLoadMoreRowsCache(true);
    });
  }

  function onItemClick(id: string) {
    setSelectedItems((s) => {
      const checked = s.some((i) => i === id);
      return checked ? s.filter((i) => i !== id) : s.concat(id);
    });
  }

  function onItemRemoveClick(id: string) {
    deleter.mutate(id);
  }

  function onItemEditClick(record: Record) {
    inputForm.setFieldsValue(record);
    setCurRecord(record);
    setInputType('编辑');
    setInputVisable(true);
  }

  function cancelAllSelect() {
    setSelectedItems([]);
  }

  // react-window-infinite
  // const length = pages?.length || 0;
  // If there are more items to be loaded then add an extra row to hold a loading indicator.
  // const itemCount = hasNextPage ? length + 1 : length;

  // Only load 1 page of items at a time.
  // Pass an empty callback to InfiniteLoader in case it asks us to load more than once.
  const loadMoreItems = () => fetchNextPage();

  // Every row is loaded except for our loading indicator row.
  // const isItemLoaded = index => !hasNextPage || index < pages.length;
  const isItemLoaded = ({ index }: { index: number }) =>
    !hasNextPage || index < pages?.length;

  // Render an item or a loading indicator.
  function renderItem({ index, style, key, parent }: ListRowProps) {
    const record = pages[index];
    const selected = selectedItems.some((s) => s === record?._id);

    return (
      <CellMeasurer parent={parent} cache={cache} key={key} rowIndex={index}>
        <div style={style} key={key}>
          {!isItemLoaded({ index }) ? (
            'Loading...'
          ) : (
            <RecordItem
              key={record._id}
              record={record}
              selected={selected}
              onClick={onItemClick}
              onEditClick={onItemEditClick}
              onRemoveClick={onItemRemoveClick}
            />
          )}
        </div>
      </CellMeasurer>
    );
  }

  function renderList({
    onRowsRendered,
    registerChild,
  }: InfiniteLoaderChildProps) {
    return (
      <List
        rowCount={total}
        ref={registerChild}
        width={contentRect?.width || 0}
        height={contentRect?.height || 0}
        onRowsRendered={onRowsRendered}
        rowRenderer={renderItem}
        deferredMeasurementCache={cache}
        rowHeight={cache.rowHeight}
      />
    );
  }

  return (
    <Layout style={{ height: '100%' }}>
      <RecordHeader>
        <Menu
          mode="horizontal"
          style={{ margin: '0 auto' }}
          onSelect={onMenuSelect}
          selectedKeys={selectedKeys}
        >
          <Menu.Item key="enabled">可复习</Menu.Item>
          <Menu.Item key="cooling">冷却中</Menu.Item>
          <Menu.Item key="done">己完成</Menu.Item>
          <Menu.Item key="all">全部</Menu.Item>
        </Menu>
        <Button type="link" size="small" onClick={showSortModal}>
          排序
        </Button>
        <Modal
          visible={sortVisable}
          title="排序"
          onCancel={hideSortModal}
          onOk={onSortSubmit}
        >
          <Form onFinish={onSortSubmit} form={sortForm}>
            <Form.Item
              name="sort"
              label="排序关键字"
              rules={[{ required: true }]}
            >
              <Radio.Group>
                <Radio.Button value="reviewAt">复习时间</Radio.Button>
                <Radio.Button value="createAt">添加时间</Radio.Button>
                <Radio.Button value="exp">熟练度</Radio.Button>
              </Radio.Group>
            </Form.Item>
            <Form.Item
              name="orderby"
              label="排序方向"
              rules={[{ required: true }]}
            >
              <Radio.Group>
                <Radio.Button value="1">升序</Radio.Button>
                <Radio.Button value="-1">降序</Radio.Button>
              </Radio.Group>
            </Form.Item>
            <Form.Item>
              <Button style={{ opacity: 0 }} htmlType="submit">
                提交
              </Button>
            </Form.Item>
            <Form.Item>
              <Button type="dashed" danger onClick={onSortCancel}>
                取消排序
              </Button>
            </Form.Item>
          </Form>
        </Modal>
      </RecordHeader>
      <Content>
        <div style={{ width: '100%', height: '100%' }} ref={contentRef}>
          {pages?.length ? (
            <InfiniteLoader
              itemCount={total}
              loadMoreRows={loadMoreItems}
              isRowLoaded={isItemLoaded}
              ref={infiniteRef}
            >
              {renderList}
            </InfiniteLoader>
          ) : (
            <CenterEmpty />
          )}
        </div>
      </Content>
      <RecordFooter>
        <Space style={{ marginRight: '12px' }}>
          {selectedItems.length}/{total}
          <Button type="dashed" onClick={cancelAllSelect}>
            取消选择
          </Button>
          {/* <Button danger>删除所选</Button> */}
        </Space>
        <Space>
          <Button type="primary">复习所选</Button>
          <Button type="primary">随机复习</Button>
          <Button
            type="primary"
            shape="circle"
            icon={<PlusOutlined />}
            onClick={showInpurModal}
            data-input-type="新建"
          />
        </Space>
      </RecordFooter>
      <Modal
        title={inputType}
        visible={inputVisable}
        onCancel={hideInputModal}
        onOk={onInputSubmit}
      >
        <Form form={inputForm} onFinish={onInputSubmit}>
          <Form.Item name="source" label="原文" rules={[{ required: true }]}>
            <Input.TextArea autoSize allowClear />
          </Form.Item>
          <Form.Item
            name="translation"
            label="译文"
            rules={[{ required: true }]}
          >
            <Input.TextArea autoSize allowClear />
          </Form.Item>
          <Form.Item>
            <Button style={{ opacity: 0 }} htmlType="submit">
              提交
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};
