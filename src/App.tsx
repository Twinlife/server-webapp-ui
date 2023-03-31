/*
 *  Copyright (c) 2021-2022 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { Component } from "react";
import { BrowserRouter, Route, Switch } from "react-router-dom";
import Call from './Call';

import './App.css';

type Props = {};

type State = {
  page: string;
};

export default class MainApp extends Component<Props, State> {

  constructor(props: Props) {
    super(props);
    this.state = {
      page: "call"
    };
  }

  handleAddContainer = () => {
    this.setState({page: "call"});
  };

  render() {
    return (<BrowserRouter>
      <Switch>
        <Route exact path="/call" component={Call}/>
        <Route path="/call/:id" component={Call}/>
      </Switch>
    </BrowserRouter>);
  }
}

// export default new MainApp({});
