import React from 'react';
import Eth from 'ethjs';
import {Layout, Divider, Card, Icon, Spin, Alert, Row, Col, Button, Tag, message, Table} from 'antd';
import {NETWORKS, AGENT_STATE, AGI, FORMAT_UTILS} from '../util';

class Services extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      agents : [],
      selectedAgent: undefined,
    };

    this.servicesTableKeys = [
      {
        title:      'Agent',
        dataIndex:  'name',
        width:      200,
      },
      {
        title:      'Contract Address',
        dataIndex:  'address',
        width:      '20ch',
        render:     (address, agent, index) =>
          this.props.network &&
          <Tag>
            <a target="_blank" href={`${NETWORKS[this.props.network].etherscan}/address/${address}`}>
              {FORMAT_UTILS.toHumanFriendlyAddressPreview(address)}
            </a>
          </Tag>
      },
      {
        title:      'Current Price',
        dataIndex:  'currentPrice',
        render:     (currentPrice, agent, index) => `${AGI.toDecimal(currentPrice)} AGI`,
      },
      {
        title:      'Agent Endpoint',
        dataIndex:  'endpoint',
        width: '23ch'
      },
      {
        title:      '',
        dataIndex:  'state',
        render:     (state, agent, index) =>
          <Button type={state == AGENT_STATE.ENABLED ? 'primary' : 'danger'} disabled={ !(state == AGENT_STATE.ENABLED) || typeof this.props.account === 'undefined' || typeof this.state.selectedAgent !== 'undefined' } onClick={() => { this.setState({ selectedAgent: agent }); return this.props.onAgentClick(agent); }} >
            { this.getAgentButtonText(state, agent) }
          </Button>
        }
    ].map(column => Object.assign({}, { width: 150 }, column));

    this.watchRegistryTimer = undefined;
  }

  getAgentButtonText(state, agent) {
    if (this.props.account) {
      if (typeof this.state.selectedAgent === 'undefined' || this.state.selectedAgent.address !== agent.address) {
        return state == AGENT_STATE.ENABLED ? 'Create Job' : 'Agent Disabled';
      } else {
        return 'Selected';
      }
    } else {
      return 'Unlock account';
    }
  }

  componentWillMount() {
    this.watchRegistryTimer = setInterval(() => this.watchRegistry(), 500);
  }

  componentWillUnmount() {
    clearInterval(this.watchRegistryTimer);
  }

  watchRegistry() {
    if(this.props.registry && this.props.agentContract) {
      this.props.registry.listRecords().then(response => {

        let agents = {};
        response[0].map((input, index) => {
          agents[Eth.toAscii(input)] = {
            name: Eth.toAscii(input),
            address: response[1][index],
            key: response[1][index],
          }
        });

        let promises = [];
        
        promises.push(fetch('/featured.json').then(response => response.json()))

        for(let agent in agents) {
          let agentInstance = this.props.agentContract.at(agents[agent].address);
          agents[agent]['contractInstance'] = agentInstance;

          let statePromise    = agentInstance.state();
          let pricePromise    = agentInstance.currentPrice();
          let endpointPromise = agentInstance.endpoint();
          promises.push(statePromise, pricePromise, endpointPromise);

          Promise.all([statePromise, pricePromise, endpointPromise]).then(values => {
            agents[agent]['state']        = values[0][0];
            agents[agent]['currentPrice'] = values[1][0];
            agents[agent]['endpoint']     = values[2][0];
          });
        }

        Promise.all(promises).then(([featured]) => {
          if (this.props.network) {
            let otherAgents = []
            this.setState({
              agents: Object.assign(
                {},
                {
                  featured: Object.values(agents).filter(agent => {
                    const test = featured.includes(agent.address)
                    if (test) {
                      return test
                    } else {
                      otherAgents.push(agent)
                    }
                  }),
                  other: otherAgents
                }
              )
            })
          } else {
            this.setState({
              agents: []
            })
          }
        });
      });
    }
  }

  render() {

    let servicesTable = (columns, dataSource, featured) =>
      <React.Fragment>
        {/* featured ? <h5><Icon type="star" /> Featured</h5> : <h5>Other</h5> */}
        <Table className="services-table" scroll={{ x: true }} columns={columns} pagination={dataSource.length > 10} dataSource={dataSource} />
        <br/>
      </React.Fragment>
    
    /* All services go in one table for now
    let featuredServices = () => servicesTable(this.servicesTableKeys, this.state.agents.featured, true)
    let otherServices = () => servicesTable(this.servicesTableKeys, this.state.agents.other)
    */
    // TODO: destroy the allServices table once we go live with the Featured agents distinction
    let allServicesList = () =>
      Object.values(this.state.agents).reduce((acc, cur) =>
        cur.length !== 0 ? acc.concat(cur) : acc, [])

    let allServicesTable = () => servicesTable(this.servicesTableKeys, allServicesList())

    return(
      <Card title={
        <React.Fragment>
          <Icon type="table" />
          <Divider type="vertical"/>
            Agents
        </React.Fragment> }>
        {/* TODO: Destroy the allServices table rendering once we go live with the Featured agents distinction, restore the two tables */} 
        {
          this.state.agents
          && (
            (this.state.agents.featured && this.state.agents.featured.length !== 0)
            || (this.state.agents.other && this.state.agents.other.length !== 0)
          )
          && allServicesTable()
        }
        {
          /*
          {this.state.agents.featured && this.state.agents.featured.length !== 0 && featuredServices()}
          {this.state.agents.other && this.state.agents.other.length !== 0 && otherServices()}
          */
        }
      </Card>
    )
  }
}

export default Services;
